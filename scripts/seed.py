"""
药店会员系统 - 模拟数据生成 v4 (真实分布)

改进点:
1. 真实中文姓名 (常用姓 + 常用名组合)
2. 会员生命周期 (新客/活跃/沉睡/流失/高价值)
3. 慢性病复购模式 (高血压/糖尿病患者定期购药)
4. 门店差异化 (旗舰店销量高、社区店稳定、医院店处方多)
5. 商品关联性 (感冒药搭退烧药、高血压药搭他汀)
6. 季节性爆发 (流感季、过敏季、节日囤货)
7. 消费水平分化 (80/20 法则)
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

# 真实中文姓名库
SURNAMES = [
    "张", "王", "李", "赵", "刘", "陈", "杨", "黄", "周", "吴",
    "徐", "孙", "马", "朱", "胡", "郭", "何", "林", "罗", "高",
    "梁", "郑", "谢", "宋", "唐", "韩", "曹", "许", "邓", "冯",
]
GIVEN_NAMES_MALE = [
    "伟", "强", "磊", "军", "勇", "杰", "涛", "明", "超", "华",
    "飞", "鹏", "刚", "辉", "建国", "志明", "文博", "子轩", "浩然", "宇轩",
]
GIVEN_NAMES_FEMALE = [
    "芳", "静", "丽", "娟", "敏", "燕", "玲", "霞", "婷", "雪",
    "晓梅", "秀英", "美玲", "小红", "思琪", "欣怡", "雨萱", "梦琪", "诗涵", "佳琪",
]

# 门店配置 (销量倍率、处方药比例、客群特征)
PHARMACIES = [
    ("大参林药房(南城店)", "东莞市", "南城街道", "旗舰店", "鸿福路108号", 1.5, 0.25, "白领/家庭"),
    ("大参林药房(东城店)", "东莞市", "东城街道", "社区店", "东城大道168号", 1.0, 0.30, "社区居民"),
    ("海王星辰(莞城店)", "东莞市", "莞城街道", "旗舰店", "西城楼大街2号", 1.4, 0.20, "年轻人群"),
    ("海王星辰(万江店)", "东莞市", "万江街道", "社区店", "莞穗大道42号", 0.9, 0.28, "老年人多"),
    ("老百姓大药房(虎门店)", "东莞市", "虎门镇", "医院店", "太沙路164号", 1.2, 0.45, "医院患者"),
    ("老百姓大药房(长安店)", "东莞市", "长安镇", "社区店", "锦厦社区", 1.0, 0.30, "工厂工人"),
    ("一心堂(厚街店)", "东莞市", "厚街镇", "社区店", "厚街大道2号", 0.8, 0.32, "家庭主妇"),
    ("益丰药房(塘厦店)", "东莞市", "塘厦镇", "社区店", "塘龙中路68号", 0.9, 0.28, "混合人群"),
    ("漱玉平民(大朗店)", "东莞市", "大朗镇", "社区店", "富民大道58号", 0.7, 0.25, "老年人多"),
    ("健之佳(樟木头店)", "东莞市", "樟木头镇", "医院店", "怡安街56号", 0.8, 0.40, "慢病患者"),
]

# 商品分类 -> (一级分类, [商品列表])
PRODUCT_TREE = {
    "感冒发烧": {
        "l1": "呼吸系统",
        "seasonal": "winter",  # 冬季高发
        "items": [
            ("感冒灵颗粒", 12.5, "OTC", 0.8, 25),      # (名, 基价, 类型, 毛利率, 权重)
            ("布洛芬缓释胶囊", 18.0, "OTC", 0.7, 20),
            ("连花清瘟胶囊", 25.0, "OTC", 0.65, 15),
            ("板蓝根颗粒", 10.0, "OTC", 0.75, 12),
            ("对乙酰氨基酚片", 8.0, "OTC", 0.8, 10),
            ("小柴胡颗粒", 15.0, "OTC", 0.7, 8),
            ("抗病毒口服液", 22.0, "OTC", 0.6, 5),
            ("清开灵胶囊", 20.0, "OTC", 0.65, 5),
        ],
    },
    "肠胃消化": {
        "l1": "消化系统",
        "seasonal": "summer",  # 夏季高发
        "items": [
            ("蒙脱石散", 28.0, "OTC", 0.7, 15),
            ("健胃消食片", 12.0, "OTC", 0.8, 20),
            ("藿香正气水", 9.0, "OTC", 0.85, 18),
            ("益生菌胶囊", 58.0, "OTC", 0.6, 8),
            ("乳酸菌素片", 15.0, "OTC", 0.75, 12),
            ("保和丸", 10.0, "OTC", 0.8, 10),
            ("香砂养胃丸", 14.0, "OTC", 0.7, 8),
            ("枫蓼肠胃康颗粒", 18.0, "OTC", 0.65, 9),
        ],
    },
    "皮肤外用": {
        "l1": "皮肤科",
        "seasonal": "spring",  # 春季过敏
        "items": [
            ("红霉素软膏", 6.0, "OTC", 0.85, 15),
            ("皮炎平软膏", 12.0, "OTC", 0.8, 18),
            ("达克宁乳膏", 22.0, "OTC", 0.7, 12),
            ("云南白药创可贴", 8.0, "OTC", 0.75, 20),
            ("百多邦软膏", 28.0, "OTC", 0.65, 8),
            ("炉甘石洗剂", 10.0, "OTC", 0.8, 10),
            ("曲安奈德乳膏", 15.0, "处方药", 0.7, 7),
            ("酮康唑乳膏", 18.0, "OTC", 0.7, 10),
        ],
    },
    "维生素保健": {
        "l1": "营养保健",
        "seasonal": "all",  # 全年稳定
        "items": [
            ("维生素C片", 15.0, "OTC", 0.8, 20),
            ("维生素B族片", 20.0, "OTC", 0.75, 15),
            ("钙尔奇D片", 58.0, "OTC", 0.65, 12),
            ("鱼油软胶囊", 88.0, "OTC", 0.6, 8),
            ("叶酸片", 35.0, "OTC", 0.7, 10),
            ("铁剂口服液", 42.0, "OTC", 0.65, 8),
            ("锌咀嚼片", 25.0, "OTC", 0.7, 12),
            ("多种维生素", 68.0, "OTC", 0.6, 15),
        ],
    },
    "心脑血管": {
        "l1": "心脑血管",
        "seasonal": "winter",  # 冬季高发
        "items": [
            ("阿司匹林肠溶片", 18.0, "处方药", 0.75, 25),  # 慢性病，复购高
            ("硝苯地平缓释片", 22.0, "处方药", 0.7, 20),
            ("阿托伐他汀钙片", 45.0, "处方药", 0.6, 18),
            ("美托洛尔缓释片", 38.0, "处方药", 0.65, 12),
            ("缬沙坦胶囊", 32.0, "处方药", 0.7, 10),
            ("氨氯地平片", 28.0, "处方药", 0.7, 8),
            ("银杏叶片", 25.0, "OTC", 0.75, 5),
            ("复方丹参滴丸", 30.0, "OTC", 0.7, 2),
        ],
    },
    "抗生素": {
        "l1": "抗感染",
        "seasonal": "all",
        "items": [
            ("阿莫西林胶囊", 12.0, "处方药", 0.8, 20),
            ("头孢克肟分散片", 28.0, "处方药", 0.7, 15),
            ("罗红霉素胶囊", 15.0, "处方药", 0.75, 12),
            ("左氧氟沙星片", 20.0, "处方药", 0.7, 10),
            ("甲硝唑片", 8.0, "处方药", 0.85, 8),
            ("阿奇霉素片", 18.0, "处方药", 0.75, 10),
            ("头孢拉定胶囊", 10.0, "处方药", 0.8, 12),
            ("诺氟沙星胶囊", 9.0, "处方药", 0.8, 13),
        ],
    },
    "中成药": {
        "l1": "中成药",
        "seasonal": "autumn",
        "items": [
            ("六味地黄丸", 22.0, "OTC", 0.75, 15),
            ("逍遥丸", 18.0, "OTC", 0.8, 12),
            ("归脾丸", 20.0, "OTC", 0.75, 10),
            ("知柏地黄丸", 25.0, "OTC", 0.7, 8),
            ("补中益气丸", 16.0, "OTC", 0.8, 12),
            ("安神补脑液", 28.0, "OTC", 0.7, 15),
            ("天王补心丹", 30.0, "OTC", 0.65, 8),
            ("血府逐瘀胶囊", 35.0, "OTC", 0.6, 20),
        ],
    },
    "儿童用药": {
        "l1": "儿科",
        "seasonal": "winter",
        "items": [
            ("美林布洛芬混悬液", 22.0, "OTC", 0.7, 20),
            ("泰诺林对乙酰氨基酚", 25.0, "OTC", 0.65, 18),
            ("妈咪爱益生菌", 32.0, "OTC", 0.6, 12),
            ("小儿感冒颗粒", 18.0, "OTC", 0.75, 15),
            ("止咳糖浆", 15.0, "OTC", 0.8, 10),
            ("小儿七星茶", 20.0, "OTC", 0.75, 8),
            ("开塞露", 5.0, "OTC", 0.9, 10),
            ("退热贴", 12.0, "OTC", 0.8, 7),
        ],
    },
}

# 季节性因子
SEASONAL_FACTORS = {
    "winter": [1.5, 1.3, 1.0, 0.7, 0.5, 0.4, 0.4, 0.5, 0.7, 1.0, 1.3, 1.6],
    "summer": [0.8, 0.8, 0.9, 1.0, 1.2, 1.3, 1.4, 1.3, 1.1, 1.0, 0.9, 0.8],
    "spring": [0.7, 0.7, 0.9, 1.1, 1.3, 1.5, 1.5, 1.4, 1.2, 1.0, 0.8, 0.7],
    "autumn": [1.1, 1.0, 1.0, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.1, 1.2],
    "all": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
}

# 会员类型 -> 购买特征
MEMBER_PROFILES = {
    "chronic": {  # 慢性病患者 (高血压/糖尿病)
        "ratio": 0.15,
        "avg_order_value": 150,
        "purchase_interval_days": 28,  # 每月复购
        "preferred_categories": ["心脑血管", "抗生素"],
        "loyalty": 0.9,  # 高忠诚度
        "level_bias": "gold",
    },
    "family": {  # 家庭采购
        "ratio": 0.25,
        "avg_order_value": 120,
        "purchase_interval_days": 14,
        "preferred_categories": ["感冒发烧", "维生素保健", "儿童用药"],
        "loyalty": 0.6,
        "level_bias": "silver",
    },
    "young": {  # 年轻人 (偶尔买)
        "ratio": 0.30,
        "avg_order_value": 45,
        "purchase_interval_days": 45,
        "preferred_categories": ["皮肤外用", "维生素保健"],
        "loyalty": 0.3,
        "level_bias": "normal",
    },
    "elderly": {  # 老年人
        "ratio": 0.20,
        "avg_order_value": 80,
        "purchase_interval_days": 20,
        "preferred_categories": ["心脑血管", "中成药", "维生素保健"],
        "loyalty": 0.8,
        "level_bias": "silver",
    },
    "occasional": {  # 随机购买
        "ratio": 0.10,
        "avg_order_value": 35,
        "purchase_interval_days": 90,
        "preferred_categories": [],  # 无偏好
        "loyalty": 0.1,
        "level_bias": "normal",
    },
}

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

# 2026 年节假日
HOLIDAYS_2026 = {
    "2026-01-01", "2026-01-02", "2026-01-03",
    "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-02-19", "2026-02-20", "2026-02-21",
    "2026-04-04", "2026-04-05", "2026-04-06",
    "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
    "2026-06-19", "2026-06-20", "2026-06-21",
    "2026-09-25", "2026-09-26", "2026-09-27",
    "2026-10-01", "2026-10-02", "2026-10-03",
    "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
}

REFUND_REASONS = ["质量问题", "效果不佳", "发错货", "过期", "过敏反应", "不需要了", "价格问题"]
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

def get_seasonal_factor(seasonal_key, month):
    factors = SEASONAL_FACTORS.get(seasonal_key, [1.0] * 12)
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

def generate_chinese_name(gender):
    """生成真实中文姓名"""
    surname = random.choice(SURNAMES)
    given = random.choice(GIVEN_NAMES_MALE if gender == "male" else GIVEN_NAMES_FEMALE)
    return surname + given


# ============================================================================
# 建表
# ============================================================================

def create_tables(cursor):
    tables = [
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
            member_type VARCHAR(20),  # chronic/family/young/elderly/occasional
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
    print("生成日期维度...")
    start = datetime(2025, 6, 1).date()
    end = datetime(2026, 12, 31).date()
    dates = []
    current = start
    while current <= end:
        dates.append((
            current, current.year, (current.month - 1) // 3 + 1, current.month,
            current.isocalendar()[1], current.weekday(),
            ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][current.weekday()],
            current.weekday() >= 5, is_holiday(current), f"{current.month}月",
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
    pharmacy_configs = []
    for name, city, district, store_type, addr, sales_factor, rx_ratio, crowd in PHARMACIES:
        lat = round(random.uniform(22.9, 23.1), 6)
        lon = round(random.uniform(113.6, 113.9), 6)
        opening = datetime(2020, 1, 1) + timedelta(days=random.randint(0, 1000))
        cursor.execute("""
            INSERT INTO dim_pharmacy (name, city, district, store_type, address, latitude, longitude, opening_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (name, city, district, store_type, addr, lat, lon, opening.date()))
        pid = cursor.fetchone()[0]
        pharmacy_ids.append(pid)
        pharmacy_configs.append({
            "id": pid,
            "sales_factor": sales_factor,
            "rx_ratio": rx_ratio,
            "crowd": crowd,
        })
    return pharmacy_ids, pharmacy_configs


def generate_dim_product(cursor):
    print("生成商品维度...")
    product_map = {}
    for cat_l2, info in PRODUCT_TREE.items():
        for prod_name, base_price, rx_type, margin, weight in info["items"]:
            is_hot = weight >= 15
            price_noise = random.uniform(0.9, 1.1)
            price = round(base_price * price_noise, 2)
            cost = round(price * (1 - margin), 2)
            stock = random.randint(100, 500) if is_hot else random.randint(30, 150)
            is_rx = rx_type == "处方药"
            cursor.execute("""
                INSERT INTO dim_product (name, category_l1, category_l2, brand, specification, dosage_form, price, cost, is_rx, is_hot, stock)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                prod_name, info["l1"], cat_l2, info.get("brand", "通用"),
                info.get("spec", ""), info.get("form", "片剂"), price, cost, is_rx, is_hot, stock,
            ))
            pid = cursor.fetchone()[0]
            product_map[prod_name] = {
                "id": pid,
                "price": price,
                "cost": cost,
                "category_l1": info["l1"],
                "category_l2": cat_l2,
                "weight": weight,
                "seasonal": info.get("seasonal", "all"),
            }
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
        cursor.execute("INSERT INTO dim_payment (code, name) VALUES (%s, %s) RETURNING id", (code, name))
        payment_ids[code] = cursor.fetchone()[0]
    return payment_ids


def generate_dim_member(cursor, pharmacy_ids, pharmacy_configs):
    """生成 800 个会员，带真实分布"""
    print("生成 800 个会员 (真实分布)...")
    member_ids = []
    member_data = []  # 存储会员详细信息用于后续生成订单
    now = datetime.now()

    # 按会员类型分配数量
    profile_counts = {}
    remaining = 800
    for mtype, profile in MEMBER_PROFILES.items():
        count = int(800 * profile["ratio"])
        profile_counts[mtype] = min(count, remaining)
        remaining -= profile_counts[mtype]
    profile_counts["occasional"] += remaining  # 剩余归为随机购买

    member_seq = 0
    for mtype, count in profile_counts.items():
        profile = MEMBER_PROFILES[mtype]
        for _ in range(count):
            member_seq += 1
            gender = random.choice(["male", "female"])
            name = generate_chinese_name(gender)
            phone = f'1{random.choice(["38", "39", "58", "59", "86", "87"])}{random.randint(10000000, 99999999)}'

            # 年龄分布: 慢性病偏大，年轻人偏小
            if mtype == "chronic":
                age = random.randint(45, 75)
            elif mtype == "elderly":
                age = random.randint(60, 80)
            elif mtype == "young":
                age = random.randint(18, 35)
            elif mtype == "family":
                age = random.randint(28, 50)
            else:
                age = random.randint(20, 65)

            birth_date = (now - timedelta(days=age * 365 + random.randint(0, 364))).date()

            # 注册日期: 老会员多，新会员少
            days_ago = random.choices(
                [random.randint(30, 90), random.randint(90, 365), random.randint(365, 700)],
                weights=[0.2, 0.5, 0.3]
            )[0]
            register_date = (now - timedelta(days=days_ago)).date()

            # 门店偏好: 70% 概率选固定门店
            if random.random() < 0.7:
                pharmacy_id = random.choice(pharmacy_ids[:5])  # 前5家大店
            else:
                pharmacy_id = random.choice(pharmacy_ids)

            # 初始消费 (幂律分布)
            if mtype == "chronic":
                total_spent = round(random.uniform(1000, 8000), 2)
            elif mtype == "elderly":
                total_spent = round(random.uniform(300, 3000), 2)
            elif mtype == "family":
                total_spent = round(random.uniform(500, 5000), 2)
            elif mtype == "young":
                total_spent = round(random.uniform(50, 800), 2)
            else:
                total_spent = round(float(np.random.zipf(1.8)) * 5, 2)
                total_spent = min(total_spent, 500)

            level = assign_member_level(total_spent)
            order_count = max(1, int(total_spent / random.uniform(40, 150)))
            points = int(total_spent * 0.1)

            # 时间线
            first_order_date = register_date + timedelta(days=random.randint(1, min(30, days_ago)))
            if first_order_date > now.date():
                first_order_date = now.date()

            last_order_days_ago = random.randint(0, min(60, days_ago))
            last_order_date = (now - timedelta(days=last_order_days_ago)).date() if order_count > 0 else None

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

            cursor.execute("""
                INSERT INTO dim_member (name, phone, gender, birth_date, register_date, first_order_date,
                    last_order_date, level, points, total_spent, order_count, is_active, segment, pharmacy_id, member_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                name, phone, gender, birth_date, register_date, first_order_date,
                last_order_date, level, points, total_spent, order_count, is_active, segment, pharmacy_id, mtype,
            ))
            mid = cursor.fetchone()[0]
            member_ids.append(mid)
            member_data.append({
                "id": mid,
                "type": mtype,
                "pharmacy_id": pharmacy_id,
                "preferred_categories": profile["preferred_categories"],
                "purchase_interval": profile["purchase_interval_days"],
                "avg_order_value": profile["avg_order_value"],
                "loyalty": profile["loyalty"],
            })

    return member_ids, member_data


# ============================================================================
# 生成事实数据
# ============================================================================

def generate_fact_orders(cursor, member_data, pharmacy_configs, product_map, promo_ids, payment_ids):
    """生成订单事实表，带真实购买模式"""
    print("生成订单事实表 (带真实模式)...")
    now = datetime.now()
    order_ids = []
    order_seq = 0

    # 产品权重表
    product_names = list(product_map.keys())
    product_weights = [product_map[p]["weight"] for p in product_names]
    total_pw = sum(product_weights)
    product_probs = [w / total_pw for w in product_weights]

    # 按月生成
    for month_offset in range(18):
        base_date = now - timedelta(days=30 * (17 - month_offset))
        month = base_date.month

        for member in member_data:
            # 根据会员类型决定本月是否购买
            if random.random() > member["loyalty"] * 0.8:
                continue

            # 购买次数 (慢性病每月1次，家庭每月2-3次)
            if member["type"] == "chronic":
                purchase_count = 1 if random.random() < 0.8 else 0
            elif member["type"] == "family":
                purchase_count = random.choices([1, 2, 3], weights=[0.3, 0.5, 0.2])[0]
            elif member["type"] == "young":
                purchase_count = 1 if random.random() < 0.3 else 0
            elif member["type"] == "elderly":
                purchase_count = random.choices([1, 2], weights=[0.6, 0.4])[0]
            else:
                purchase_count = 1 if random.random() < 0.15 else 0

            for _ in range(purchase_count):
                # 选日期 (月初发薪日效应 + 节假日效应)
                day = random.choices(
                    range(1, 29),
                    weights=[1.2 if d <= 5 else (2.0 if is_holiday(base_date.replace(day=d)) else 1.0) for d in range(1, 29)]
                )[0]
                order_date = base_date.replace(day=min(day, 28)).date()

                if order_date > now.date():
                    continue

                # 选商品 (偏好 + 随机)
                if member["preferred_categories"] and random.random() < 0.6:
                    # 从偏好分类选
                    preferred_products = [p for p in product_names if product_map[p]["category_l2"] in member["preferred_categories"]]
                    if preferred_products:
                        selected_names = random.choices(
                            preferred_products,
                            weights=[product_map[p]["weight"] for p in preferred_products],
                            k=random.randint(1, min(3, len(preferred_products))),
                        )
                    else:
                        selected_names = random.choices(product_names, weights=product_probs, k=random.randint(1, 3))
                else:
                    # 随机选
                    num_items = random.randint(1, 3)
                    selected_names = random.choices(product_names, weights=product_probs, k=num_items)

                # 去重
                selected_names = list(set(selected_names))

                # 选门店 (偏好门店)
                if random.random() < member["loyalty"]:
                    pharmacy_id = member["pharmacy_id"]
                else:
                    pharmacy_id = random.choice(list(set(m["pharmacy_id"] for m in member_data)))

                # 找门店配置
                pharmacy_config = next((p for p in pharmacy_configs if p["id"] == pharmacy_id), pharmacy_configs[0])

                # 选促销
                use_promo = random.random() < 0.25
                promo_id = random.choice(promo_ids) if use_promo else None

                # 选支付方式
                pay_method = random.choices(
                    list(payment_ids.keys()),
                    weights=[45, 35, 10, 10],
                )[0]
                payment_id = payment_ids[pay_method]

                # 生成订单行
                for pname in selected_names:
                    pinfo = product_map[pname]
                    pid = pinfo["id"]
                    price = pinfo["price"]

                    # 数量
                    if member["type"] == "chronic" and pinfo["category_l2"] == "心脑血管":
                        qty = random.choices([1, 2, 3], weights=[0.5, 0.3, 0.2])[0]  # 慢性病囤货
                    else:
                        qty = random.choices([1, 2], weights=[0.7, 0.3])[0]

                    subtotal = round(qty * price, 2)
                    discount = round(subtotal * random.uniform(0, 0.12), 2) if use_promo else 0
                    pay_amount = round(subtotal - discount, 2)
                    points_earned = int(pay_amount * 0.1)

                    status = random.choices(
                        ["completed", "refunded", "pending"],
                        weights=[0.90, 0.07, 0.03],
                    )[0]

                    order_seq += 1
                    order_no = f"ORD{order_date.strftime('%Y%m%d')}{str(order_seq).zfill(6)}"
                    order_datetime = datetime.combine(order_date, datetime.min.time()) + timedelta(
                        hours=random.randint(8, 21), minutes=random.randint(0, 59)
                    )

                    cursor.execute("""
                        INSERT INTO fact_orders (order_no, order_date, member_id, pharmacy_id,
                            product_id, promotion_id, payment_id, quantity, unit_price,
                            discount, pay_amount, points_earned, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        order_no, order_date, member["id"], pharmacy_id,
                        pid, promo_id, payment_id, qty, price,
                        discount, pay_amount, points_earned, status,
                    ))
                    order_ids.append(cursor.fetchone()[0])

    return order_ids


def generate_fact_behavior(cursor, member_data, product_map):
    """生成行为事实表"""
    print("生成行为事实表...")
    now = datetime.now()
    product_ids = [v["id"] for v in product_map.values()]
    behaviors = []

    for member in member_data:
        # 每个会员生成 5-20 条行为
        count = random.randint(5, 20)
        for _ in range(count):
            product_id = random.choice(product_ids)
            action = weighted_choice(ACTION_WEIGHTS, ACTION_PROBS)
            channel = weighted_choice(CHANNEL_WEIGHTS, CHANNEL_PROBS)
            days_ago = random.randint(0, 180)
            created_at = now - timedelta(days=days_ago, hours=random.randint(6, 23), minutes=random.randint(0, 59))
            behaviors.append((member["id"], product_id, action, channel, "direct", created_at))

    execute_values(cursor, """
        INSERT INTO fact_behavior (member_id, product_id, action, channel, referrer, created_at)
        VALUES %s
    """, behaviors)
    return len(behaviors)


def generate_fact_inventory(cursor, product_ids, pharmacy_ids):
    """生成库存变动"""
    print("生成库存事实表...")
    now = datetime.now()
    logs = []
    for _ in range(800):
        product_id = random.choice(product_ids)
        pharmacy_id = random.choice(pharmacy_ids)
        change_type = weighted_choice(["purchase", "restock", "return", "adjust"], [55, 30, 10, 5])
        qty = -random.randint(1, 5) if change_type == "purchase" else (
            random.randint(10, 100) if change_type == "restock" else (
                random.randint(1, 3) if change_type == "return" else random.randint(-5, 5)
            )
        )
        days_ago = random.randint(0, 180)
        created_at = now - timedelta(days=days_ago, hours=random.randint(6, 20))
        logs.append((product_id, pharmacy_id, change_type, qty, created_at))

    execute_values(cursor, """
        INSERT INTO fact_inventory (product_id, pharmacy_id, change_type, quantity, created_at)
        VALUES %s
    """, logs)
    return len(logs)


def generate_fact_refunds(cursor, order_ids, member_data, product_ids, pharmacy_ids):
    """生成退款记录"""
    print("生成退款事实表...")
    now = datetime.now()
    refund_count = int(len(order_ids) * 0.07)
    refunds = []

    for i in range(refund_count):
        order_id = random.choice(order_ids)
        member = random.choice(member_data)
        product_id = random.choice(product_ids)
        pharmacy_id = random.choice(pharmacy_ids)
        refund_amount = round(random.uniform(10, 250), 2)
        refund_reason = random.choice(REFUND_REASONS)
        refund_date = (now - timedelta(days=random.randint(0, 180))).date()

        refunds.append((f"REF{refund_date.strftime('%Y%m%d')}{str(i+1).zfill(6)}",
                        order_id, member["id"], product_id, pharmacy_id,
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
    print("药店会员系统 - 模拟数据生成 v4 (真实分布)")
    print("=" * 50)

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        print("\n清理旧表...")
        for table in ["fact_refunds", "fact_inventory", "fact_behavior", "fact_orders",
                       "dim_payment", "dim_promotion", "dim_product", "dim_pharmacy",
                       "dim_member", "dim_date"]:
            cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
        conn.commit()

        print("创建表结构...")
        create_tables(cursor)
        conn.commit()

        generate_dim_date(cursor)
        pharmacy_ids, pharmacy_configs = generate_dim_pharmacy(cursor)
        product_map = generate_dim_product(cursor)
        promo_ids = generate_dim_promotion(cursor)
        payment_ids = generate_dim_payment(cursor)
        member_ids, member_data = generate_dim_member(cursor, pharmacy_ids, pharmacy_configs)
        conn.commit()

        product_ids = [v["id"] for v in product_map.values()]
        order_ids = generate_fact_orders(cursor, member_data, pharmacy_configs, product_map, promo_ids, payment_ids)
        generate_fact_behavior(cursor, member_data, product_map)
        generate_fact_inventory(cursor, product_ids, pharmacy_ids)
        generate_fact_refunds(cursor, order_ids, member_data, product_ids, pharmacy_ids)
        conn.commit()

        print("\n" + "=" * 50)
        print("数据生成完成!")
        print("=" * 50)
        for t in ["dim_date", "dim_member", "dim_product", "dim_pharmacy",
                   "dim_promotion", "dim_payment", "fact_orders", "fact_behavior", "fact_inventory", "fact_refunds"]:
            cursor.execute(f"SELECT COUNT(*) FROM {t}")
            print(f"  {t}: {cursor.fetchone()[0]:>6}")

        print("\n会员类型分布:")
        cursor.execute("SELECT member_type, COUNT(*) FROM dim_member GROUP BY member_type ORDER BY COUNT(*) DESC")
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]}")

        print("\n会员等级分布:")
        cursor.execute("SELECT level, COUNT(*) FROM dim_member GROUP BY level ORDER BY COUNT(*) DESC")
        for row in cursor.fetchall():
            print(f"  {LEVEL_NAMES.get(row[0], row[0])}: {row[1]}")

        print("\n门店销量:")
        cursor.execute("""
            SELECT p.name, COUNT(o.id), SUM(o.pay_amount)
            FROM fact_orders o JOIN dim_pharmacy p ON o.pharmacy_id = p.id
            GROUP BY p.name ORDER BY COUNT(o.id) DESC
        """)
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} 单, ¥{row[2]:,.0f}")

    except Exception as e:
        conn.rollback()
        print(f"错误: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    generate_data()
