-- CreateTable
CREATE TABLE "DirectorVerification" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorRemovalRequest" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorRemovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectorVerification_token_key" ON "DirectorVerification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorVerification_branchId_email_key" ON "DirectorVerification"("branchId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorRemovalRequest_token_key" ON "DirectorRemovalRequest"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorRemovalRequest_branchId_email_key" ON "DirectorRemovalRequest"("branchId", "email");

-- AddForeignKey
ALTER TABLE "DirectorVerification" ADD CONSTRAINT "DirectorVerification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorRemovalRequest" ADD CONSTRAINT "DirectorRemovalRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
