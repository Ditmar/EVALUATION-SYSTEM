import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_TEACHER_EMAIL;
  const password = process.env.SEED_TEACHER_PASSWORD;
  const name = process.env.SEED_TEACHER_NAME || "Docente Administrador";

  if (!email || !password) {
    throw new Error(
      "SEED_TEACHER_EMAIL y SEED_TEACHER_PASSWORD deben estar definidas en el entorno para crear el docente inicial."
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const teacher = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Docente listo: ${teacher.email} (id=${teacher.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
