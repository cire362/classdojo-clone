-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "studentId" TEXT,
    "uploadedById" TEXT,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletedFile" (
    "id" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoredFile_groupId_idx" ON "StoredFile"("groupId");

-- CreateIndex
CREATE INDEX "StoredFile_studentId_idx" ON "StoredFile"("studentId");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedById_idx" ON "StoredFile"("uploadedById");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- У файла ровно один хозяин: группа или ученик
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_one_owner" CHECK (("groupId" IS NULL) <> ("studentId" IS NULL));

-- Каскады в базе не трогают диск, поэтому каждое удаление строки ставит файл в очередь очистки
CREATE FUNCTION queue_deleted_file() RETURNS trigger AS $$
BEGIN
  INSERT INTO "DeletedFile" ("id") VALUES (OLD."id");
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stored_file_deleted AFTER DELETE ON "StoredFile" FOR EACH ROW EXECUTE FUNCTION queue_deleted_file();
