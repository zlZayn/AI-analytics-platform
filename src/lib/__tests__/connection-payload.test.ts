import { describe, expect, it } from "vitest"
import { buildConnectionPayload, type ConnectionFormValues } from "@/lib/connection-payload"

const form: ConnectionFormValues = {
  name: "prod",
  description: "生产库",
  host: "db.internal",
  port: 5432,
  database: "app",
  username: "analyst",
  password: "",
  ssl: true,
}

describe("buildConnectionPayload", () => {
  it("新建时提交完整表单（空密码由服务端必填校验拦截）", () => {
    expect(buildConnectionPayload(form, null)).toEqual(form)
  })

  it("编辑时空密码不提交 password：字段缺省即保留原密文", () => {
    const payload = buildConnectionPayload(form, "conn-1")

    expect(payload).not.toHaveProperty("password")
    expect(payload).toMatchObject({ username: "analyst", ssl: true, database: "app" })
  })

  it("编辑时填写新密码则提交", () => {
    const payload = buildConnectionPayload({ ...form, password: "new-secret" }, "conn-1")

    expect(payload.password).toBe("new-secret")
  })
})
