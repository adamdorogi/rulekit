CREATE TYPE "Role" AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Workspace" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL
);

CREATE TABLE "Membership" (
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "role" "Role" NOT NULL,
    PRIMARY KEY ("userId", "workspaceId")
);

CREATE TABLE "Project" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");
