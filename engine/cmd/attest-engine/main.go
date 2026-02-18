package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/attest-ai/attest/engine/internal/server"
)

const version = "0.1.0-dev"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "version" {
		fmt.Printf("attest-engine %s\n", version)
		os.Exit(0)
	}

	// Parse flags
	logLevel := flag.String("log-level", "info", "log level: debug, info, warn, error")
	flag.Parse()

	// Configure logger
	var level slog.Level
	switch *logLevel {
	case "debug":
		level = slog.LevelDebug
	case "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		fmt.Fprintf(os.Stderr, "invalid log level: %s\n", *logLevel)
		os.Exit(1)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: level}))

	// Create server
	srv := server.New(os.Stdin, os.Stdout, logger)
	server.RegisterBuiltinHandlers(srv)

	// Handle signals
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	logger.Info("engine starting", "version", version)
	if err := srv.Run(ctx); err != nil {
		logger.Error("engine error", "err", err)
		os.Exit(1)
	}
	logger.Info("engine shutdown complete")
}
