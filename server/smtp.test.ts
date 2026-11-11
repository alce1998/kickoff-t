import { describe, expect, it } from "vitest";
import nodemailer from "nodemailer";

describe("SMTP Configuration", () => {
  it("should have SMTP environment variables configured", () => {
    expect(process.env.SMTP_HOST).toBeDefined();
    expect(process.env.SMTP_PORT).toBeDefined();
    expect(process.env.SMTP_USER).toBeDefined();
    expect(process.env.SMTP_PASS).toBeDefined();
  });

  it("should have valid SMTP host format", () => {
    const smtpHost = process.env.SMTP_HOST;
    expect(smtpHost).toBe("smtp.gmail.com");
  });

  it("should have valid SMTP port", () => {
    const smtpPort = process.env.SMTP_PORT;
    expect(smtpPort).toBe("587");
  });

  it("should be able to create a nodemailer transporter", () => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Skip if credentials not configured
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn("SMTP credentials not configured, skipping transporter test");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || "587"),
      secure: smtpPort === "465",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Verify transporter was created successfully
    expect(transporter).toBeDefined();
    expect(transporter.options).toBeDefined();
  });
});
