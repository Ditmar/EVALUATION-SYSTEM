#!/bin/sh
set -e

echo "Aplicando migraciones de Prisma..."
npx prisma migrate deploy

echo "Verificando/creando usuario docente inicial..."
npx tsx prisma/seed.ts

echo "Iniciando la aplicación..."
exec npm run start
