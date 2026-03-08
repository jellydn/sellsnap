-- CreateIndex
CREATE INDEX "Product_creatorId_idx" ON "Product"("creatorId");

-- CreateIndex
CREATE INDEX "Purchase_productId_idx" ON "Purchase"("productId");

-- CreateIndex
CREATE INDEX "Purchase_customerEmail_idx" ON "Purchase"("customerEmail");

-- CreateIndex
CREATE INDEX "Purchase_stripeSessionId_idx" ON "Purchase"("stripeSessionId");
