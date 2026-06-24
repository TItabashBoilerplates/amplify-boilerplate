import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import {
  assertSpyCalls,
  type Spy,
  spy,
  type Stub,
  stub,
} from "@std/testing/mock";

// Logger をテスト
describe("Edge Functions Logger", () => {
  // deno-lint-ignore no-explicit-any
  let consoleLogSpy: Spy<Console, any[], void>;
  // deno-lint-ignore no-explicit-any
  let consoleErrorSpy: Spy<Console, any[], void>;
  // deno-lint-ignore no-explicit-any
  let consoleWarnSpy: Spy<Console, any[], void>;
  let envStub: Stub<typeof Deno.env, [string], string | undefined> | null =
    null;

  beforeEach(() => {
    consoleLogSpy = spy(console, "log");
    consoleErrorSpy = spy(console, "error");
    consoleWarnSpy = spy(console, "warn");
  });

  afterEach(() => {
    consoleLogSpy.restore();
    consoleErrorSpy.restore();
    consoleWarnSpy.restore();
    if (envStub) {
      envStub.restore();
      envStub = null;
    }
  });

  describe("logger export", () => {
    it("should export logger", async () => {
      const { logger } = await import("./index.ts");
      assertExists(logger);
    });

    it("should have all log methods", async () => {
      const { logger } = await import("./index.ts");
      assertEquals(typeof logger.trace, "function");
      assertEquals(typeof logger.debug, "function");
      assertEquals(typeof logger.info, "function");
      assertEquals(typeof logger.warn, "function");
      assertEquals(typeof logger.error, "function");
      assertEquals(typeof logger.child, "function");
    });
  });

  describe("createFunctionLogger", () => {
    it("should create logger with functionName", async () => {
      const { createFunctionLogger } = await import("./index.ts");
      const fnLogger = createFunctionLogger("my-function");
      assertExists(fnLogger);
      assertEquals(typeof fnLogger.info, "function");
    });
  });

  describe("log output", () => {
    it("should call console.log for info level", async () => {
      // 本番環境（JSON出力）をシミュレート
      envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "LOG_LEVEL") return "info";
        if (key === "LOG_FORMAT") return "json";
        return undefined;
      });

      // モジュールを再読み込み
      const module = await import(`./index.ts?t=${Date.now()}`);
      module.logger.info("test message");

      assertSpyCalls(consoleLogSpy, 1);
    });

    it("should call console.error for error level", async () => {
      envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "LOG_LEVEL") return "info";
        if (key === "LOG_FORMAT") return "json";
        return undefined;
      });

      const module = await import(`./index.ts?t=${Date.now() + 1}`);
      module.logger.error("error message");

      assertSpyCalls(consoleErrorSpy, 1);
    });

    it("should call console.warn for warn level", async () => {
      envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "LOG_LEVEL") return "info";
        if (key === "LOG_FORMAT") return "json";
        return undefined;
      });

      const module = await import(`./index.ts?t=${Date.now() + 2}`);
      module.logger.warn("warning message");

      assertSpyCalls(consoleWarnSpy, 1);
    });
  });

  describe("log level filtering", () => {
    it("should not log below current level", async () => {
      envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "LOG_LEVEL") return "warn";
        if (key === "LOG_FORMAT") return "json";
        return undefined;
      });

      const module = await import(`./index.ts?t=${Date.now() + 3}`);
      module.logger.info("should not appear");
      module.logger.debug("should not appear");

      // info と debug は出力されない
      assertSpyCalls(consoleLogSpy, 0);
    });

    it("should log at or above current level", async () => {
      envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "LOG_LEVEL") return "warn";
        if (key === "LOG_FORMAT") return "json";
        return undefined;
      });

      const module = await import(`./index.ts?t=${Date.now() + 4}`);
      module.logger.warn("should appear");
      module.logger.error("should also appear");

      assertSpyCalls(consoleWarnSpy, 1);
      assertSpyCalls(consoleErrorSpy, 1);
    });
  });

  describe("child logger", () => {
    it("should create child logger with inherited context", async () => {
      envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "LOG_LEVEL") return "info";
        if (key === "LOG_FORMAT") return "json";
        return undefined;
      });

      const module = await import(`./index.ts?t=${Date.now() + 5}`);
      const childLogger = module.logger.child({ requestId: "req-123" });

      assertExists(childLogger);
      assertEquals(typeof childLogger.info, "function");

      childLogger.info("test with context");

      assertSpyCalls(consoleLogSpy, 1);
      const logOutput = consoleLogSpy.calls[0].args[0] as string;
      assertEquals(logOutput.includes("requestId"), true);
    });
  });

  describe("JSON output format", () => {
    it("should output valid JSON in production mode", async () => {
      envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "LOG_LEVEL") return "info";
        if (key === "LOG_FORMAT") return "json";
        return undefined;
      });

      const module = await import(`./index.ts?t=${Date.now() + 6}`);
      module.logger.info("json test", { userId: "user-456" });

      assertSpyCalls(consoleLogSpy, 1);
      const logOutput = consoleLogSpy.calls[0].args[0] as string;

      // JSON としてパースできるか確認
      const parsed = JSON.parse(logOutput);
      assertEquals(parsed.message, "json test");
      assertEquals(parsed.userId, "user-456");
      assertEquals(parsed.level, "info");
      assertExists(parsed.timestamp);
    });
  });
});
