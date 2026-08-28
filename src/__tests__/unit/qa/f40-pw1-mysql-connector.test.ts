import { describe, expect, it } from "vitest";
import {
  assertReadOnlyQuery,
  getPw1DbConfig,
} from "@/lib/admin/qa/pw1-mysql-connector";

describe("[US-F40-PW1-Connector] Read-Only Security Guardrails", () => {
  it("allows safe SELECT, SHOW, DESCRIBE and EXPLAIN queries", () => {
    expect(() => assertReadOnlyQuery("SELECT * FROM products;")).not.toThrow();
    expect(() => assertReadOnlyQuery("SELECT id, title, price FROM products WHERE store_id = 1;")).not.toThrow();
    expect(() => assertReadOnlyQuery("SHOW TABLES;")).not.toThrow();
    expect(() => assertReadOnlyQuery("SHOW COLUMNS FROM `categories`;")).not.toThrow();
    expect(() => assertReadOnlyQuery("DESCRIBE products;")).not.toThrow();
    expect(() => assertReadOnlyQuery("EXPLAIN SELECT * FROM orders;")).not.toThrow();
  });

  it("strictly blocks and rejects any INSERT mutation statements", () => {
    expect(() => assertReadOnlyQuery("INSERT INTO products (title) VALUES ('Hacked');")).toThrow(
      /SECURITY ERROR/,
    );
  });

  it("strictly blocks and rejects any UPDATE mutation statements", () => {
    expect(() => assertReadOnlyQuery("UPDATE products SET price = 0 WHERE id = 1;")).toThrow(
      /SECURITY ERROR/,
    );
  });

  it("strictly blocks and rejects any DELETE mutation statements", () => {
    expect(() => assertReadOnlyQuery("DELETE FROM products WHERE id = 1;")).toThrow(
      /SECURITY ERROR/,
    );
  });

  it("strictly blocks and rejects any DDL DROP, ALTER, TRUNCATE statements", () => {
    expect(() => assertReadOnlyQuery("DROP TABLE products;")).toThrow(/SECURITY ERROR/);
    expect(() => assertReadOnlyQuery("ALTER TABLE products ADD COLUMN hacked text;")).toThrow(
      /SECURITY ERROR/,
    );
    expect(() => assertReadOnlyQuery("TRUNCATE TABLE orders;")).toThrow(/SECURITY ERROR/);
    expect(() => assertReadOnlyQuery("CREATE TABLE rogue (id int);")).toThrow(/SECURITY ERROR/);
  });

  it("strictly blocks sneaky sub-mutations embedded in queries", () => {
    expect(() =>
      assertReadOnlyQuery("SELECT * FROM products; DELETE FROM users;"),
    ).toThrow(/SECURITY ERROR/);
  });

  it("parses PW1 configuration from environment variables", () => {
    const originalEnv = process.env.PW1_DATABASE_URL;
    try {
      process.env.PW1_DATABASE_URL = "mysql://qa_user:qa_pass@127.0.0.1:3306/legacy_db";
      const config = getPw1DbConfig();
      expect(config).toBeDefined();
      expect(config?.url).toBe("mysql://qa_user:qa_pass@127.0.0.1:3306/legacy_db");
    } finally {
      process.env.PW1_DATABASE_URL = originalEnv;
    }
  });
});
