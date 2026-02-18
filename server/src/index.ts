import express, { Application, Request, Response, NextFunction } from "express";

import { createServer, Server as HTTPServer } from "http";
import { config } from "./config";
import { logger } from "./utils/logger";
import { healthRouter } from "./routes/health";
import { initRedis, closeRedis } from "./services/redis";
import { initPostgres, closePostgres } from "./services/postgres";
import { startBatchSync, stopBatchSync } from "./services/batch-sync";
import {
  initAISStreamClient,
  stopAISStreamClient,
} from "./services/aisstream-client";
import {
  initWebSocketServer,
  stopWebSocketServer,
} from "./services/websocket-server";

class Server {
  private app: Application;
  private httpServer: HTTPServer | null = null;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Graceful shutdown middleware
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      if (this.isShuttingDown) {
        res.status(503).json({ error: "Server is shutting down" });
        return;
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Root endpoint
    this.app.get("/", (_req: Request, res: Response) => {
      res.json({
        name: "AIS Viewer API",
        version: "1.0.0",
        status: "running",
      });
    });

    // Health check routes
    this.app.use("/health", healthRouter);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: "Not Found",
        path: req.path,
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(
      (err: Error, req: Request, res: Response, _next: NextFunction) => {
        logger.error({
          error: err.message,
          stack: err.stack,
          path: req.path,
          method: req.method,
        });

        res.status(500).json({
          error: "Internal Server Error",
          message:
            config.nodeEnv === "development"
              ? err.message
              : "An error occurred",
        });
      },
    );
  }

  public async start(): Promise<void> {
    try {
      // Initialize Redis connection
      logger.info("Initializing Redis connection...");
      await initRedis();

      // Initialize PostgreSQL connection
      logger.info("Initializing PostgreSQL connection...");
      await initPostgres();

      // Initialize AISStream client
      logger.info("Initializing AISStream client...");
      await initAISStreamClient();

      // Start batch sync service
      logger.info("Starting batch sync service...");
      await startBatchSync();

      // Create HTTP server
      this.httpServer = createServer(this.app);

      // Initialize WebSocket server
      logger.info("Initializing WebSocket server...");
      await initWebSocketServer(this.httpServer, "/ws");

      // Start HTTP server
      this.httpServer.listen(config.port, () => {
        logger.info(
          {
            port: config.port,
            env: config.nodeEnv,
            wsPath: "/ws",
            nodeVersion: process.version,
          },
          `🚀 AIS Viewer API is running on port ${config.port}`,
        );
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error({ error }, "Failed to start server");
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Received shutdown signal");
      this.isShuttingDown = true;

      // Give ongoing requests time to complete
      setTimeout(async () => {
        logger.info("Shutting down services...");

        try {
          // Stop WebSocket server
          await stopWebSocketServer();

          // Stop AISStream client
          await stopAISStreamClient();

          // Stop batch sync service
          await stopBatchSync();

          // Close Redis connection
          await closeRedis();

          // Close PostgreSQL connection
          await closePostgres();

          // Close HTTP server
          if (this.httpServer) {
            await new Promise<void>((resolve) => {
              this.httpServer!.close(() => {
                logger.info("HTTP server closed");
                resolve();
              });
            });
          }

          logger.info("Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          logger.error({ error }, "Error during shutdown");
          process.exit(1);
        }
      }, 5000); // 5 seconds
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      logger.error({ error }, "Uncaught exception");
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error({ reason, promise }, "Unhandled rejection");
      process.exit(1);
    });
  }
}

// Start the server
const server = new Server();
server.start();
