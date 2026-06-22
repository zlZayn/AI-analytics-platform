"""
药店会员系统 - 模拟数据生成 v3 (星型模型)

设计原则:
1. 星型架构: fact_ 事实表 + dim_ 维度表
2. 真实分布: Zipf 销量、指数购买间隔、季节性+节假日脉冲
3. 丰富维度: 日期/会员/商品/门店/促销/支付方式
4. 动态会员升级: 累计消费驱动等级变化
5. 完整链路: 行为 -> 购买 -> 退款 -> 复购
"""

import random
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import execute_values

import numpy as np

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "ai_analytics",
    "user": "postgres",
    "password": "Lzy20050914",
}

# ============================================================================
# 常量与配置
# ============================================================================

LEVELS = ["normal", "silver", "gold", "diamond"]
LEVEL_NAMES = {
    "normal": "普通会员",
    "silver": "银卡会员",
    "gold": "金卡会员",
    "diamond": "钻石会员",
}
LEVEL_DISCOUNT = {"normal": 1.0, "silver": 0.98, "gold": 0.95, "diamond": 0.90}
LEVEL_THRESHOLDS = {"silver": 500, "gold": 2000, "diamond": 5000}

PHARMACIES = [
    ("大参林药房(南城店)", "东莞市", "南城街道", "社区店", "鸿福路108号"),
    ("大参林药房(东城店)", "东莞市", "东城街道", "社区店", "东城大道168号"),
    ("海王星辰(莞城店)", "东莞市", "莞城街道", "旗舰店", "西城楼大街2号"),
    ("海王星辰(万江店)", "东莞市", "万江街道", "社区店", "莞穗大道42号"),
    ("老百姓大药房(虎门店)", "东莞市", "虎门镇", "医院店", "太沙路164号"),
    ("老百姓大药房(长安店)", "东莞市", "长安镇", "社区店", "锦厦社区"),
    ("一心堂(厚街店)", "东莞市", "厚街镇", "社区店", "厚街大道2号"),
    ("益丰药房(塘厦店)", "东莞市", "塘厦镇", "社区店", "塘龙中路68号"),
    ("漱玉平民(大朗店)", "东莞市", "大朗镇", "社区店", "富民大道58号"),
    ("健之佳(樟木头店)", "东莞市", "樟木头镇", "医院店", "怡安街56号"),
]

# 二级分类 -> (一级分类, 品牌, 规格, 剂型, [商品列表])
PRODUCT_TREE = {
    "感冒发烧": {
        "l1": "呼吸系统",
        "brand": "白云山",
        "spec": "10g*9袋",
        "form": "颗粒剂",
        "items": [
            ("感冒灵颗粒", 12.5, "OTC"),
            ("布洛芬缓释胶囊", 18.0, "OTC"),
            ("连花清瘟胶囊", 25.0, "OTC"),
            ("板蓝根颗粒", 10.0, "OTC"),
            ("对乙酰氨基酚片", 8.0, "OTC"),
            ("小柴胡颗粒", 15.0, "OTC"),
            ("抗病毒口服液", 22.0, "OTC"),
            ("清开灵胶囊", 20.0, "OTC"),
        ],
    },
    "肠胃消化": {
        "l1": "消化系统",
        "brand": "同仁堂",
        "spec": "10袋",
        "form": "散剂",
        "items": [
            ("蒙脱石散", 28.0, "OTC"),
            ("健胃消食片", 12.0, "OTC"),
            ("藿香正气水", 9.0, "OTC"),
            ("益生菌胶囊", 58.0, "OTC"),
            ("乳酸菌素片", 15.0, "OTC"),
            ("保和丸", 10.0, "OTC"),
            ("香砂养胃丸", 14.0, "OTC"),
            ("枫蓼肠胃康颗粒", 18.0, "OTC"),
        ],
    },
    "皮肤外用": {
        "l1": "皮肤科",
        "brand": "云南白药",
        "spec": "20g",
        "form": "软膏剂",
        "items": [
            ("红霉素软膏", 6.0, "OTC"),
            ("皮炎平软膏", 12.0, "OTC"),
            ("达克宁乳膏", 22.0, "OTC"),
            ("云南白药创可贴", 8.0, "OTC"),
            ("百多邦软膏", 28.0, "OTC"),
            ("炉甘石洗剂", 10.0, "OTC"),
            ("曲安奈德乳膏", 15.0, "处方药"),
            ("酮康唑乳膏", 18.0, "OTC"),
        ],
    },
    "维生素保健": {
        "l1": "营养保健",
        "brand": "汤臣倍健",
        "spec": "60片",
        "form": "片剂",
        "items": [
            ("维生素C片", 15.0, "OTC"),
            ("维生素B族片", 20.0, "OTC"),
            ("钙尔奇D片", 58.0, "OTC"),
            ("鱼油软胶囊", 88.0, "OTC"),
            ("叶酸片", 35.0, "OTC"),
            ("铁剂口服液", 42.0, "OTC"),
            ("锌咀嚼片", 25.0, "OTC"),
            ("多种维生素", 68.0, "OTC"),
        ],
    },
    "心脑血管": {
        "l1": "心脑血管",
        "brand": "辉瑞",
        "spec": "7片",
        "form": "片剂",
        "items": [
            ("阿司匹林肠溶片", 18.0, "处方药"),
            ("硝苯地平缓释片", 22.0, "处方药"),
            ("阿托伐他汀钙片", 45.0, "处方药"),
            ("美托洛尔缓释片", 38.0, "处方药"),
            ("缬沙坦胶囊", 32.0, "处方药"),
            ("氨氯地平片", 28.0, "处方药"),
            ("银杏叶片", 25.0, "OTC"),
            ("复方丹参滴丸", 30.0, "OTC"),
        ],
    },
    "抗生素": {
        "l1": "抗感染",
        "brand": "联邦制药",
        "spec": "24粒",
        "form": "胶囊剂",
        "items": [
            ("阿莫西林胶囊", 12.0, "处方药"),
            ("头孢克肟分散片", 28.0, "处方药"),
            ("罗红霉素胶囊", 15.0, "处方药"),
            ("左氧氟沙星片", 20.0, "处方药"),
            ("甲硝唑片", 8.0, "处方药"),
            ("阿奇霉素片", 18.0, "处方药"),
            ("头孢拉定胶囊", 10.0, "处方药"),
            ("诺氟沙星胶囊", 9.0, "处方药"),
        ],
    },
    "中成药": {
        "l1": "中成药",
        "brand": "同仁堂",
        "spec": "200丸",
        "form": "丸剂",
        "items": [
            ("六味地黄丸", 22.0, "OTC"),
            ("逍遥丸", 18.0, "OTC"),
            ("归脾丸", 20.0, "OTC"),
            ("知柏地黄丸", 25.0, "OTC"),
            ("补中益气丸", 16.0, "OTC"),
            ("安神补脑液", 28.0, "OTC"),
            ("天王补心丹", 30.0, "OTC"),
            ("血府逐瘀胶囊", 35.0, "OTC"),
        ],
    },
    "儿童用药": {
        "l1": "儿科",
        "brand": "美林",
        "spec": "100ml",
        "form": "口服液",
        "items": [
            ("美林布洛芬混悬液", 22.0, "OTC"),
            ("泰诺林对乙酰氨基酚", 25.0, "OTC"),
            ("妈咪爱益生菌", 32.0, "OTC"),
            ("小儿感冒颗粒", 18.0, "OTC"),
            ("止咳糖浆", 15.0, "OTC"),
            ("小儿七星茶", 20.0, "OTC"),
            ("开塞露", 5.0, "OTC"),
            ("退热贴", 12.0, "OTC"),
        ],
    },
}

# 热门商品 -> 基础权重 (Zipf 分布叠加)
HOT_ITEMS = {
    "感冒灵颗粒": 20,
    "布洛芬缓释胶囊": 16,
    "维生素C片": 14,
    "钙尔奇D片": 12,
    "阿莫西林胶囊": 11,
    "健胃消食片": 10,
    "连花清瘟胶囊": 9,
    "板蓝根颗粒": 8,
    "达克宁乳膏": 7,
    "云南白药创可贴": 6,
}

MEMBER_NAMES = [
    "张伟", "王芳", "李静", "刘洋", "陈明", "杨帆", "黄磊", "周杰",
    "吴倩", "郑强", "冯刚", "赵丽颖", "唐嫣", "刘诗诗",
    "张三丰", "李小龙", "王思聪", "赵敏", "周芷若",
    "张学友", "刘德华", "郭富城", "黎明", "周润发",
    "成龙", "李连杰", "甄子丹", "吴京", "黄渤",
]

PAYMENT_METHODS = [
    ("wechat", "微信支付"),
    ("alipay", "支付宝"),
    ("cash", "现金"),
    ("card", "银行卡"),
]

PROMOTIONS = [
    ("满100减10", "满减", 100, 10, 0.15),
    ("满200减30", "满减", 200, 30, 0.25),
    ("会员日8折", "折扣", 0, 0, 0.10),
    ("新品立减20", "立减", 0, 20, 0.08),
    ("买二送一", "赠品", 0, 0, 0.12),
]

# 2026 年中国法定节假日/调休 (日期字符串)
HOLIDAYS_2026 = {
    # 元旦
    "2026-01-01", "2026-01-02", "2026-01-03",
    # 春节 (假设 2/17 除夕)
    "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-02-19", "2026-02-20", "2026-02-21",
    # 清明
    "2026-04-04", "2026-04-05", "2026-04-06",
    # 劳动节
    "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
    # 端午
    "2026-06-19", "2026-06-20", "2026-06-21",
    # 中秋+国庆
    "2026-09-25", "2026-09-26", "2026-09-27",
    "2026-10-01", "2026-10-02", "2026-10-03",
    "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
}

# 季节性因子 (月份 1-12)
SEASONAL_FACTORS = {
    "呼吸系统": [1.5, 1.3, 1.0, 0.7, 0.5, 0.4, 0.4, 0.5, 0.7, 1.0, 1.3, 1.6],
    "消化系统": [0.8, 0.8, 0.9, 1.0, 1.2, 1.3, 1.4, 1.3, 1.1, 1.0, 0.9, 0.8],
    "皮肤科": [0.7, 0.7, 0.9, 1.1, 1.3, 1.5, 1.5, 1.4, 1.2, 1.0, 0.8, 0.7],
    "营养保健": [1.0, 1.0, 1.1, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    "心脑血管": [1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3],
    "抗感染": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    "中成药": [1.1, 1.0, 1.0, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.1, 1.2],
    "儿科": [1.3, 1.2, 1.0, 0.8, 0.6, 0.5, 0.5, 0.6, 0.8, 1.0, 1.2, 1.4],
}

REFUND_REASONS = ["质量问题", "效果不佳", "发错货", "过期", "过敏反应", "不需要了", "价格问题"]

DEVICES = [
    "iPhone 14", "iPhone 15", "iPhone 16",
    "Samsung S23", "Samsung S24",
    "Huawei P60", "Huawei Mate60",
    "Xiaomi 14", "Xiaomi 15",
]

ACTION_WEIGHTS = ["view", "favorite", "cart", "purchase"]
ACTION_PROBS = [50, 20, 15, 15]

CHANNEL_WEIGHTS = ["app", "mini_program", "h5", "pos"]
CHANNEL_PROBS = [40, 25, 15, 20]


# ============================================================================
# 工具函数
# ============================================================================

def is_holiday(dt):
    return dt.strftime("%Y-%m-%d") in HOLIDAYS_2026


def is_weekend(dt):
    return dt.weekday() >= 5


def get_seasonal_factor(l1_category, month):
    factors = SEASONAL_FACTORS.get(l1_category, [1.0] * 12)
    return factors[month - 1]


def assign_member_level(total_spent):
    if total_spent >= LEVEL_THRESHOLDS["diamond"]:
        return "diamond"
    if total_spent >= LEVEL_THRESHOLDS["gold"]:
        return "gold"
    if total_spent >= LEVEL_THRESHOLDS["silver"]:
        return "silver"
    return "normal"


def weighted_choice(items, weights):
    return items[np.random.choice(len(items), p=np.array(weights) / sum(weights))]


def random_date_in_range(start_days_ago, end_days_ago):
    days = random.randint(end_days_ago, start_days_ago)
    dt = datetime.now() - timedelta(days=days, hours=random.randint(6, 22), minutes=random.randint(0, 59))
    return dt


# ============================================================================
# 建表
# ============================================================================

def create_tables(cursor):
    tables = [
        # ---- 维度表 ----
        """CREATE TABLE IF NOT EXISTS dim_date (
            date_key DATE PRIMARY KEY,
            year INTEGER NOT NULL,
            quarter INTEGER NOT NULL,
            month INTEGER NOT NULL,
            week INTEGER NOT NULL,
            day_of_week INTEGER NOT NULL,
            day_name VARCHAR(10) NOT NULL,
            is_weekend BOOLEAN DEFAULT false,
            is_holiday BOOLEAN DEFAULT false,
            month_name VARCHAR(10) NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS dim_member (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            phone VARCHAR(20) UNIQUE NOT NULL,
            gender VARCHAR(10) NOT NULL,
            birth_date DATE,
            register_date DATE NOT NULL,
            first_order_date DATE,
            last_order_date DATE,
            last_activity_date DATE,
            level VARCHAR(20) DEFAULT 'normal',
            points INTEGER DEFAULT 0,
            total_spent DECIMAL(12,2) DEFAULT 0,
            order_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            segment VARCHAR(20) DEFAULT 'new',
            pharmacy_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS dim_product (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            category_l1 VARCHAR(50) NOT NULL,
            category_l2 VARCHAR(50) NOT NULL,
            brand VARCHAR(50) NOT NULL,
            specification VARCHAR(100),
            dosage_form VARCHAR(30) NOT NULL,
            unit VARCHAR(20) DEFAULT '盒',
            price DECIMAL(10,2) NOT NULL,
            cost DECIMAL(10,2) NOT NULL,
            is_rx BOOLEAN DEFAULT false,
            is_hot BOOLEAN DEFAULT false,
            stock INTEGER DEFAULT 100,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS dim_pharmacy (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            city VARCHAR(50) NOT NULL,
            district VARCHAR(50) NOT NULL,
            store_type VARCHAR(30) NOT NULL,
            address VARCHAR(200),
            latitude DECIMAL(10,6),
            longitude DECIMAL(10,6),
            opening_date DATE,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS dim_promotion (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL,
            min_amount DECIMAL(10,2) DEFAULT 0,
            discount_amount DECIMAL(10,2) DEFAULT 0,
            discount_rate DECIMAL(3,2) DEFAULT 1.0,
            start_date DATE,
            end_date DATE,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS dim_payment (
            id SERIAL PRIMARY KEY,
            code VARCHAR(20) UNIQUE NOT NULL,
            name VARCHAR(50) NOT NULL
        )""",
        # ---- 事实表 ----
        """CREATE TABLE IF NOT EXISTS fact_orders (
            id SERIAL PRIMARY KEY,
            order_no VARCHAR(32) NOT NULL,
            order_date DATE NOT NULL,
            member_id INTEGER REFERENCES dim_member(id),
            pharmacy_id INTEGER REFERENCES dim_pharmacy(id),
            product_id INTEGER REFERENCES dim_product(id),
            promotion_id INTEGER REFERENCES dim_promotion(id),
            payment_id INTEGER REFERENCES dim_payment(id),
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            discount DECIMAL(10,2) DEFAULT 0,
            pay_amount DECIMAL(12,2) NOT NULL,
            points_earned INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS fact_behavior (
            id SERIAL PRIMARY KEY,
            member_id INTEGER REFERENCES dim_member(id),
            product_id INTEGER REFERENCES dim_product(id),
            action VARCHAR(20) NOT NULL,
            channel VARCHAR(20) NOT NULL,
            referrer VARCHAR(30) DEFAULT 'direct',
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS fact_inventory (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES dim_product(id),
            pharmacy_id INTEGER REFERENCES dim_pharmacy(id),
            change_type VARCHAR(20) NOT NULL,
            quantity INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS fact_refunds (
            id SERIAL PRIMARY KEY,
            order_no VARCHAR(32) NOT NULL,
            order_id INTEGER REFERENCES fact_orders(id),
            member_id INTEGER REFERENCES dim_member(id),
            product_id INTEGER REFERENCES dim_product(id),
            pharmacy_id INTEGER REFERENCES dim_pharmacy(id),
            refund_amount DECIMAL(10,2) NOT NULL,
            refund_reason VARCHAR(50) NOT NULL,
            refund_date DATE NOT NULL,
            status VARCHAR(20) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT NOW()
        )""",
    ]
    for sql in tables:
        cursor.execute(sql)


# ============================================================================
# 生成维度数据
# ============================================================================

def generate_dim_date(cursor):
    """生成日期维度: 2025-06-01 ~ 2026-12-31"""
    print("生成日期维度...")
    start = datetime(2025, 6, 1).date()
    end = datetime(2026, 12, 31).date()
    dates = []
    current = start
    while current <= end:
        dates.append((
            current,
            current.year,
            (current.month - 1) // 3 + 1,
            current.month,
            current.isocalendar()[1],
            current.weekday(),
            ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][current.weekday()],
            current.weekday() >= 5,
            is_holiday(current),
            f"{current.month}月",
        ))
        current += timedelta(days=1)
    execute_values(cursor, """
        INSERT INTO dim_date (date_key, year, quarter, month, week, day_of_week, day_name, is_weekend, is_holiday, month_name)
        VALUES %s
    """, dates)
    return len(dates)


def generate_dim_pharmacy(cursor):
    print("生成门店维度...")
    pharmacy_ids = []
    for name, city, district, store_type, addr in PHARMACIES:
        lat = round(random.uniform(22.9, 23.1), 6)
        lon = round(random.uniform(113.6, 113.9), 6)
        opening = datetime(2020, 1, 1) + timedelta(days=random.randint(0, 1000))
        cursor.execute("""
            INSERT INTO dim_pharmacy (name, city, district, store_type, address, latitude, longitude, opening_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (name, city, district, store_type, addr, lat, lon, opening.date()))
        pharmacy_ids.append(cursor.fetchone()[0])
    return pharmacy_ids


def generate_dim_product(cursor):
    print("生成商品维度...")
    product_map = {}  # name -> (id, price, category_l1)
    for cat_l2, info in PRODUCT_TREE.items():
        for prod_name, base_price, rx_type in info["items"]:
            is_hot = prod_name in HOT_ITEMS
            price_noise = random.uniform(0.85, 1.15)
            price = round(base_price * price_noise, 2)
            cost = round(price * random.uniform(0.4, 0.65), 2)
            stock = random.randint(80, 500) if is_hot else random.randint(20, 200)
            is_rx = rx_type == "处方药"
            cursor.execute("""
                INSERT INTO dim_product (name, category_l1, category_l2, brand, specification, dosage_form, price, cost, is_rx, is_hot, stock)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                prod_name, info["l1"], cat_l2, info["brand"],
                info["spec"], info["form"], price, cost, is_hot, is_rx, stock,
            ))
            pid = cursor.fetchone()[0]
            product_map[prod_name] = (pid, price, info["l1"])
    return product_map


def generate_dim_promotion(cursor):
    print("生成促销维度...")
    promo_ids = []
    for name, ptype, min_amt, disc_amt, disc_rate in PROMOTIONS:
        cursor.execute("""
            INSERT INTO dim_promotion (name, type, min_amount, discount_amount, discount_rate, start_date, end_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (name, ptype, min_amt, disc_amt, disc_rate, "2026-01-01", "2026-12-31"))
        promo_ids.append(cursor.fetchone()[0])
    return promo_ids


def generate_dim_payment(cursor):
    print("生成支付方式维度...")
    payment_ids = {}
    for code, name in PAYMENT_METHODS:
        cursor.execute(
            "INSERT INTO dim_payment (code, name) VALUES (%s, %s) RETURNING id",
            (code, name),
        )
        payment_ids[code] = cursor.fetchone()[0]
    return payment_ids


def generate_dim_member(cursor, pharmacy_ids):
    """生成 800 个会员，注册日期分布在 180 天内"""
    print("生成 800 个会员...")
    member_ids = []
    now = datetime.now()

    for i in range(800):
        name = random.choice(MEMBER_NAMES) + str(random.randint(1, 999))
        phone = f'1{random.choice(["38", "39", "58", "59", "86", "87"])}{random.randint(10000000, 99999999)}'
        gender = random.choice(["male", "female"])
        age = random.randint(18, 75)
        birth_date = (now - timedelta(days=age * 365 + random.randint(0, 364))).date()
        register_date = (now - timedelta(days=random.randint(30, 180))).date()
        pharmacy_id = random.choice(pharmacy_ids)

        # 初始消费额用幂律分布模拟 (少数人高消费)
        initial_spent = float(np.random.zipf(1.5)) * 10
        initial_spent = min(initial_spent, 15000)
        total_spent = round(initial_spent, 2)
        level = assign_member_level(total_spent)

        order_count = max(0, int(total_spent / random.uniform(50, 200)))
        last_order_date = (now - timedelta(days=random.randint(0, 60))).date() if order_count > 0 else None

        # 注册日期 <= 首购日期 <= 最后购买日期
        first_order_date = None
        if order_count > 0:
            first_order_date = register_date + timedelta(days=random.randint(1, 30))
            if first_order_date > now.date():
                first_order_date = now.date()

        # 活跃判定: 30 天内有购买 = 活跃
        is_active = last_order_date and (now.date() - last_order_date).days <= 30

        # 细分标签
        if total_spent >= 3000 and order_count >= 10:
            segment = "high_value"
        elif total_spent >= 500 and order_count >= 5:
            segment = "loyal"
        elif is_active and order_count <= 2:
            segment = "new"
        elif not is_active and (now.date() - (last_order_date or register_date)).days > 60:
            segment = "churned"
        else:
            segment = "regular"

        points = int(total_spent * 0.1)

        cursor.execute("""
            INSERT INTO dim_member (name, phone, gender, birth_date, register_date, first_order_date,
                last_order_date, level, points, total_spent, order_count, is_active, segment, pharmacy_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            name, phone, gender, birth_date, register_date, first_order_date,
            last_order_date, level, points, total_spent, order_count, is_active, segment, pharmacy_id,
        ))
        member_ids.append(cursor.fetchone()[0])

    return member_ids


# ============================================================================
# 生成事实数据
# ============================================================================

def generate_fact_orders(cursor, member_ids, pharmacy_ids, product_map, promo_ids, payment_ids):
    """生成 3000 个订单 (行级事实)，含季节性 + 节假日脉冲"""
    print("生成订单事实表 (3000条)...")
    now = datetime.now()
    product_names = list(product_map.keys())
    product_weights = []
    for pname in product_names:
        product_weights.append(HOT_ITEMS.get(pname, 1))

    # 归一化权重
    total_w = sum(product_weights)
    product_probs = [w / total_w for w in product_weights]

    order_ids = []
    order_seq = 0

    # 按月生成，每月 150-250 单，带季节性
    for month_offset in range(18):  # 18 个月 (2025-07 ~ 2026-12)
        base_date = now - timedelta(days=30 * (17 - month_offset))

        # 基础订单数 + 随机波动
        base_orders = random.randint(150, 250)

        # 月份内分布
        days_in_month = 30
        for day in range(days_in_month):
            dt = base_date.replace(day=min(day + 1, 28)) - timedelta(days=base_date.day - 1)
            dt = dt + timedelta(days=day)

            if dt > now:
                continue

            # 每日订单数 = 基础 / 30 * 日因子
            day_factor = 1.0
            if is_holiday(dt):
                day_factor = 2.5  # 节假日脉冲
            elif is_weekend(dt):
                day_factor = 1.3
            elif dt.day <= 5:
                day_factor = 1.2  # 发薪日效应

            daily_orders = max(1, int(base_orders / days_in_month * day_factor * random.uniform(0.7, 1.3)))

            for _ in range(daily_orders):
                member_id = random.choice(member_ids)
                pharmacy_id = random.choice(pharmacy_ids)

                # 选商品 (1-4 件)
                num_items = random.randint(1, 4)
                selected_indices = np.random.choice(
                    len(product_names),
                    size=num_items,
                    replace=False,
                    p=product_probs,
                )

                # 使用促销 (30%)
                use_promo = random.random() < 0.3
                promo_id = random.choice(promo_ids) if use_promo else None
                pay_method = random.choices(
                    list(payment_ids.keys()),
                    weights=[45, 35, 10, 10],
                )[0]
                payment_id = payment_ids[pay_method]

                order_date = dt.date()
                order_datetime = dt + timedelta(hours=random.randint(8, 21), minutes=random.randint(0, 59))

                total_amount = 0
                for idx in selected_indices:
                    pname = product_names[idx]
                    pid, price, _ = product_map[pname]
                    qty = random.randint(1, 3)
                    subtotal = round(qty * price, 2)
                    total_amount += subtotal

                    order_seq += 1

                    # 插入订单行
                    discount = round(subtotal * random.uniform(0, 0.15), 2) if use_promo else 0
                    pay_amount = round(subtotal - discount, 2)
                    points_earned = int(pay_amount * 0.1)

                    status = random.choices(
                        ["completed", "refunded", "pending"],
                        weights=[0.88, 0.08, 0.04],
                    )[0]

                    order_no = f"ORD{order_date.strftime('%Y%m%d')}{str(order_seq).zfill(6)}"

                    cursor.execute("""
                        INSERT INTO fact_orders (order_no, order_date, member_id, pharmacy_id,
                            product_id, promotion_id, payment_id, quantity, unit_price,
                            discount, pay_amount, points_earned, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        order_no, order_date, member_id, pharmacy_id,
                        pid, promo_id, payment_id, qty, price,
                        discount, pay_amount, points_earned, status,
                    ))
                    order_ids.append(cursor.fetchone()[0])

    return order_ids


def generate_fact_behavior(cursor, member_ids, product_map):
    """生成 10000 条行为记录"""
    print("生成行为事实表 (10000条)...")
    now = datetime.now()
    product_ids = [v[0] for v in product_map.values()]

    behaviors = []
    for _ in range(10000):
        member_id = random.choice(member_ids)
        product_id = random.choice(product_ids)
        action = weighted_choice(ACTION_WEIGHTS, ACTION_PROBS)
        channel = weighted_choice(CHANNEL_WEIGHTS, CHANNEL_PROBS)

        referrer = weighted_choice(
            ["direct", "search", "ad", "recommend", "share"],
            [30, 25, 20, 15, 10],
        )

        days_ago = random.randint(0, 120)
        created_at = now - timedelta(days=days_ago, hours=random.randint(6, 23), minutes=random.randint(0, 59))

        behaviors.append((member_id, product_id, action, channel, referrer, created_at))

    execute_values(cursor, """
        INSERT INTO fact_behavior (member_id, product_id, action, channel, referrer, created_at)
        VALUES %s
    """, behaviors)
    return len(behaviors)


def generate_fact_inventory(cursor, product_ids, pharmacy_ids):
    """生成 800 条库存变动"""
    print("生成库存事实表 (800条)...")
    now = datetime.now()
    change_types = ["purchase", "restock", "return", "adjust"]
    change_probs = [55, 30, 10, 5]

    logs = []
    for _ in range(800):
        product_id = random.choice(product_ids)
        pharmacy_id = random.choice(pharmacy_ids)
        change_type = weighted_choice(change_types, change_probs)

        if change_type == "purchase":
            qty = -random.randint(1, 5)
        elif change_type == "restock":
            qty = random.randint(10, 100)
        elif change_type == "return":
            qty = random.randint(1, 3)
        else:
            qty = random.randint(-5, 5)

        days_ago = random.randint(0, 180)
        created_at = now - timedelta(days=days_ago, hours=random.randint(6, 20))

        logs.append((product_id, pharmacy_id, change_type, qty, created_at))

    execute_values(cursor, """
        INSERT INTO fact_inventory (product_id, pharmacy_id, change_type, quantity, created_at)
        VALUES %s
    """, logs)
    return len(logs)


def generate_fact_refunds(cursor, order_ids, member_ids, product_ids, pharmacy_ids):
    """生成退款记录 (约 8% 的订单退款)"""
    print("生成退款事实表...")
    now = datetime.now()
    refund_count = int(len(order_ids) * 0.08)

    refunds = []
    for _ in range(refund_count):
        order_id = random.choice(order_ids)
        member_id = random.choice(member_ids)
        product_id = random.choice(product_ids)
        pharmacy_id = random.choice(pharmacy_ids)
        refund_amount = round(random.uniform(10, 300), 2)
        refund_reason = random.choice(REFUND_REASONS)
        refund_date = (now - timedelta(days=random.randint(0, 180))).date()

        refunds.append((f"REF{refund_date.strftime('%Y%m%d')}{str(_+1).zfill(6)}",
                        order_id, member_id, product_id, pharmacy_id,
                        refund_amount, refund_reason, refund_date))

    execute_values(cursor, """
        INSERT INTO fact_refunds (order_no, order_id, member_id, product_id, pharmacy_id,
            refund_amount, refund_reason, refund_date)
        VALUES %s
    """, refunds)
    return len(refunds)


# ============================================================================
# 主流程
# ============================================================================

def generate_data():
    print("=" * 50)
    print("药店会员系统 - 模拟数据生成 v3 (星型模型)")
    print("=" * 50)

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # 清理旧表
        print("\n清理旧表...")
        for table in [
            "fact_refunds", "fact_inventory", "fact_behavior", "fact_orders",
            "dim_payment", "dim_promotion", "dim_product", "dim_pharmacy",
            "dim_member", "dim_date",
        ]:
            cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
        conn.commit()

        # 建表
        print("创建表结构...")
        create_tables(cursor)
        conn.commit()

        # 维度
        generate_dim_date(cursor)
        pharmacy_ids = generate_dim_pharmacy(cursor)
        product_map = generate_dim_product(cursor)
        promo_ids = generate_dim_promotion(cursor)
        payment_ids = generate_dim_payment(cursor)
        member_ids = generate_dim_member(cursor, pharmacy_ids)
        conn.commit()

        # 事实
        product_ids = [v[0] for v in product_map.values()]
        order_ids = generate_fact_orders(cursor, member_ids, pharmacy_ids, product_map, promo_ids, payment_ids)
        generate_fact_behavior(cursor, member_ids, product_map)
        generate_fact_inventory(cursor, product_ids, pharmacy_ids)
        generate_fact_refunds(cursor, order_ids, member_ids, product_ids, pharmacy_ids)
        conn.commit()

        # 统计
        print("\n" + "=" * 50)
        print("数据生成完成!")
        print("=" * 50)
        tables = [
            "dim_date", "dim_member", "dim_product", "dim_pharmacy",
            "dim_promotion", "dim_payment",
            "fact_orders", "fact_behavior", "fact_inventory", "fact_refunds",
        ]
        for t in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {t}")
            print(f"  {t}: {cursor.fetchone()[0]:>6}")

        # 会员等级分布
        print("\n会员等级分布:")
        cursor.execute("SELECT level, COUNT(*) FROM dim_member GROUP BY level ORDER BY COUNT(*) DESC")
        for row in cursor.fetchall():
            print(f"  {LEVEL_NAMES.get(row[0], row[0])}: {row[1]}")

        # 会员细分
        print("\n会员细分:")
        cursor.execute("SELECT segment, COUNT(*) FROM dim_member GROUP BY segment ORDER BY COUNT(*) DESC")
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]}")

    except Exception as e:
        conn.rollback()
        print(f"错误: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    generate_data()
