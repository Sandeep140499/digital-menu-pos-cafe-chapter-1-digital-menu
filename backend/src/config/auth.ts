export const jwtConfig = {
  secret: process.env.JWT_SECRET || "dev-secret",
  // default to 30 days so sessions persist unless explicitly logged out
  expiresIn: process.env.JWT_EXPIRES_IN || "30d",
};

