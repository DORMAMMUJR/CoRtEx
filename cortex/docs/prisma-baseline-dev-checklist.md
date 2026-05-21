# Prisma Baseline (Dev/Staging) - Checklist Operativo

## 1) Preparar variables
```powershell
$env:DATABASE_URL="postgresql://..."
$env:SHADOW_DATABASE_URL="postgresql://..."
```

## 2) Precheck de seguridad
```powershell
npm run prisma:baseline:precheck -- -AllowedProjectRefs <supabase_project_ref_dev>
```

## 3) Reconciliar schema con la DB real
```powershell
npm run prisma:baseline:reconcile -- -AllowedProjectRefs <supabase_project_ref_dev>
```

## 4) Crear baseline local
```powershell
npm run prisma:baseline:create -- -AllowedProjectRefs <supabase_project_ref_dev>
```

## 5) Registrar baseline como aplicada
El paso de `create` ya ejecuta:
```powershell
npx prisma migrate resolve --applied <timestamp>_baseline --schema prisma/schema.prisma
```

## 6) Validar consistencia final
```powershell
npm run prisma:baseline:validate -- -AllowedProjectRefs <supabase_project_ref_dev>
```

## Flujo completo
```powershell
npm run prisma:baseline:all -- -AllowedProjectRefs <supabase_project_ref_dev>
```

## Criterio de rollback operativo
- Si falla `precheck` o `reconcile`, detener.
- No ejecutar `create` ni `resolve`.
- Corregir variables/URL/drift y repetir desde `precheck`.
