# UNIQUE — Guía de prueba completa del flujo de administración y entrega

**Versión:** 1.0 · Noviembre 2026  
**Público:** Administrador / Operativo que va a demostrar el sistema al profesor.  
**Base:** contratos reales de `unique_api` rama `main` (commit `15ef78b`) y pantallas Angular de este repositorio.  
**Regla de oro:** todo lo que se ve en pantalla viene de Flask/MySQL. Si la base no tiene datos sembrados o publicados, el frontend mostrará listas vacías o el modo demostración. No se corrige inventando datos en Angular.

---

## 0. Verdades que hay que saber antes de empezar

1. **`python -m scripts.seed` no publica productos.** Deja productos inactivos, precio 0, variantes inactivas, stock 0 y recetas en `BORRADOR` (`scripts/seed.py:392-404,410-442,481-498`; `README.md` de la API). `/catalogo` seguirá devolviendo `[]` después de sembrar.
2. **M22 depende de la siembra.** `GET /api/v1/configuracion` devuelve la tabla `configuracion`, que se llena en `scripts/seed.py:587`. El pre-despliegue solo corre migraciones; no siembra. Si M22 muestra cero parámetros, hay que sembrar en la API, no tocar Angular.
3. **`PATCH /configuracion` solo edita claves existentes.** No se pueden crear claves nuevas desde la interfaz (`configuracion_service.py:37-41`). El cuerpo aceptado es `{"valores":{"clave":"valor"}}` o un objeto plano; todos los valores se guardan como cadena.
4. **La bolsa blanca no tiene imagen en la base real.** `datos_reales.json` publica solo `NG` y `GR` para `BO`, aunque la variante `BO-UN-BL` existe. Flask elige `galeria[0]` como imagen principal (`catalogo_service.py:202`) y Angular cae al respaldo negro cuando no hay imagen `BL` (`catalogo-servicio.ts:242`). Mientras no se corrija el dataset de Flask, el catálogo conectado a la API seguirá mostrando la bolsa negra.
5. **ADMIN hereda permisos de OPERATIVO, pero OPERATIVO no hereda de ADMIN** (`security/roles.py:46-50`). Las cotizaciones, órdenes de compra, M22 y el dashboard son ADMIN-only.
6. **El access token dura 15 minutos.** Para pruebas largas hay que renovar con `POST /api/v1/auth/refrescar` (cookie + `X-CSRF-TOKEN`). Si la sesión expira, los errores serán 401, no fallos de negocio.
7. **Los movimientos de inventario son inmutables** en MySQL (`migrations/versions/c4d5e6f7a8b9...`). Una corrección es otro movimiento, nunca editar el anterior.
8. **La loneta no pide proveedor alterno.** `TEL-LON` no está en `MATERIALES_CRITICOS` de Flask (`TEL-FEL`, `TEL-JER`, `TEL-RIB`, `HIL-EST`). Basta con un proveedor principal. El aviso que antes mostraba Angular era demasiado amplio y ya se ajustó en este repositorio.

---

## 1. Cadena oficial de un pedido (documento maestro §5.1 y §8.1)

| Etapa | Rol | Módulo | Estado del pedido |
|---:|---|---|---|
| 1. Descubrir y elegir variante | Cliente | M03 Catálogo | — |
| 2. Carrito | Cliente | M04 Carrito | — |
| 3. Identificarse | Cliente | M01 Autenticación | — |
| 4. Pagar en 7 pasos | Cliente | M05 Pago | — |
| 5. Venta + pedido + reserva | Sistema | M05, M08, M09, M12 | `RECIBIDO` → `CONFIRMADO` o `EN_PRODUCCION` |
| 6. Producir | Operativo | M16 + M15 | `EN_PRODUCCION` |
| 6b. Comprar si falta material | Admin + Operativo | M14 + M15 | `EN_PRODUCCION` |
| 7. Calidad y alta a stock | Operativo | M16 + M17 + M12 | `CONFIRMADO` |
| 8. Preparación | Operativo | M18 | `EN_PREPARACION` → `LISTO_ENVIO` |
| 9. Reparto | Operativo | M19 | `EN_REPARTO` |
| 10. Entrega | Repartidor + Operativo | M19 + M06 | `ENTREGADO` |
| 11. Posventa | Cliente | M06 + M07 | ventana de devolución |

**Regla de oro operativa:** con existencia, el pedido va de reserva (M12) a preparación (M18) y entrega (M19). Sin existencia, M16 fabrica; si falta material, M14 compra y M15 recibe; la orden se reanuda y las unidades aprobadas vuelven a M12 y se asignan al pedido más antiguo.

---

## 2. Checklist antes de tocar la interfaz

Ejecutar en el contenedor de la API (Docker local) o en el shell del servicio API (Railway):

```bash
docker compose exec api python scripts/wait_for_db.py
docker compose exec api flask db upgrade
docker compose exec api python -m scripts.seed
docker compose exec api python -m scripts.create_admin admin      # pide correo y contraseña (mín. 12 caracteres)
docker compose exec api python -m scripts.create_admin operativo  # opcional
```

Verificación mínima:

```bash
curl.exe -i http://localhost:8001/api/v1/health/db
```

En Angular confirmar `src/environments/environment.ts`: `apiBaseUrl: 'http://localhost:8001/api/v1'`. En producción la URL viene de `/runtime-config.json`.

**Cuentas que necesitarás para la prueba**

| Rol | Correo | Contraseña | Dónde se crea |
|---|---|---|---|
| ADMIN | la que escribas al crearla | la que elijas (mín. 12 caracteres en `create_admin`) | `scripts.create_admin admin` o M22 |
| OPERATIVO | la que escribas al crearla | la que elijas (mín. 12 caracteres en `create_admin`) | M22 |
| CLIENTE | `cliente@unique.mx` | la que elijas | M22 o registro público |

---

## 3. Fase 1 — M22 · Administración del sistema

**Ruta Angular:** `/panel-admin/sistema` (pestañas: Usuarios, Clientes, Catálogos, Configuración, Bitácora).  
**Rol:** solo ADMIN.  
**Contratos Flask:** `app/blueprints/admin/routes.py:76-245`.

### 3.1 Verificar que la configuración inicial cargó

En la pestaña **Configuración** deben aparecer 21 parámetros. Si aparece el aviso «Configuración inicial pendiente en la API», detén la prueba y siembra la base (`python -m scripts.seed`). Los valores sembrados son:

| Clave | Valor | Observación |
|---|---|---|
| `iva_pct` | `16` | IVA incluido |
| `margen_objetivo_pct` | `55` | Precio sugerido |
| `merma_meta_pct` | `5` | Meta de alerta |
| `proveedor_minimo_a_tiempo_pct` | `80` | Evaluación de proveedores |
| `dias_devolucion` | `15` | Propuesta pendiente de confirmar |
| `max_intentos_entrega` | `2` | Segundo fallo = alerta crítica |
| `dias_produccion_estandar` | `5` | Bajo pedido |
| `max_piezas_por_linea` | `10` | Carrito |
| `saldo_inicial_cuenta_simulada` | `5000.00` | Cuenta simulada |
| `envio_gratis_desde` | `0` | 0 desactiva el beneficio |
| `horas_max_recibido` | `2` | Pago pendiente |
| `horas_max_confirmado` | `24` | Estancamiento |
| `dias_max_en_produccion` | `7` | Estancamiento |
| `horas_max_en_preparacion` | `24` | Estancamiento |
| `horas_max_listo_envio` | `24` | Estancamiento |
| `horas_max_en_reparto` | `24` | Estancamiento |
| `horas_alerta_devolucion` | `48` | Devolución sin atender |
| `dias_carrito_abandonado` | `7` | Carrito abandonado |
| `intentos_login_max` | `5` | Bloqueo por intentos |
| `bloqueo_login_min` | `15` | Minutos de bloqueo |
| `vigencia_recuperacion_min` | `30` | Enlace de recuperación |

Para cambiar un parámetro, edita la celda y guarda. Flask guarda siempre cadenas y escribe la bitácora con `anterior` y `nuevo`.

### 3.2 Altas desde Usuarios

Campos exactos del formulario / API (`schemas/auth.py:44-51`):

| Campo | Qué poner | Regla |
|---|---|---|
| Nombre | `Ana` | 1–80 caracteres |
| Apellidos | `Operativa` | 1–120 |
| Correo | `operativo@unique.mx` | Se normaliza a minúsculas |
| Teléfono | `1234567890` | Exactamente 10 dígitos |
| Contraseña | `Operativo123!` | 8–128 caracteres |
| Rol | `OPERATIVO` | `CLIENTE`, `OPERATIVO` o `ADMIN` |

Repetir con `cliente@unique.mx`, rol `CLIENTE`. La contraseña de 8–128 caracteres corresponde al alta desde M22; si creas la cuenta con `scripts.create_admin`, usa al menos 12 caracteres. No crear un segundo ADMIN si ya hay uno: no se puede desactivar al último ADMIN ni cambiarle el rol (`422 ULTIMO_ADMIN`).

Payload equivalente por API:

```json
{
  "nombre": "Ana",
  "apellidos": "Operativa",
  "correo": "operativo@unique.mx",
  "telefono": "1234567890",
  "password": "Operativo123!",
  "rol": "OPERATIVO"
}
```

**Trampa:** en `PATCH /usuarios/{id}` no se puede enviar `correo`; el esquema solo acepta `nombre`, `apellidos`, `telefono`, `rol`, `estado_cuenta` y `acepta_promociones`.

### 3.3 Catálogos ya sembrados (no hace falta darlos de alta)

| Recurso | Valores |
|---|---|
| Color | `BL` Blanco `#FFFFFF`, `NG` Negro `#000000`, `GR` Gris `#808080`, `NA` No aplica |
| Talla | `CH` Chica, `MD` Mediana, `GD` Grande, `UN` Única |
| Categoría producto | Sudadera `SD`, Playera `PL`, Pantalón `PN`, Gorro `GO`, Bolsa de tela `BO` |
| Categoría material | Tela, Hilo, Estabilizador, Avío, Etiqueta, Empaque |
| Causa merma | Rechazo en recepción, Daño en almacén, Defecto de tela, etc. |
| Tarifa envío | Local León, CP `37000`–`37999`, costo `200.00`, 2 días |

Si falta la tarifa, darla de alta con: nombre `Local León`, `cp_inicio` `37000`, `cp_fin` `37999`, `costo` `200.00`, `dias_estimados` `2`. Los rangos no pueden traslaparse. Los códigos `BL`, `NG`, `GR`, `CH`, `MD`, `GD`, `UN`, `SD`, `PL`, `PN`, `GO`, `BO` son inmutables: si ya generaron SKU solo se pueden desactivar (`409 CODIGO_SKU_INMUTABLE`).

### 3.4 Bitácora

Al final de la prueba, la pestaña Bitácora debe mostrar entradas de `LOGIN`, altas de usuario, cambios de configuración, recepciones, producción, empaque y entrega. Filtros reales: `accion`, `entidad`, `usuario_id`, `desde`, `hasta`.

---

## 4. Fase 2 — M13 Proveedores y M15 Inventario de materia prima

### 4.1 Alta de proveedor (ADMIN)

Ruta Angular: `/proveedores` · API: `POST /api/v1/proveedores`.

| Campo | Valor exacto |
|---|---|
| Razón social | `Textiles León SA de CV` |
| Nombre comercial | `Textiles León` |
| RFC (opcional) | `LLE900101ABC` |
| Contacto | `María García` |
| Teléfono | `1234567890` |
| Correo | `proveedor@textilesleon.mx` |
| Dirección | `Calle Industrial 123, León, Guanajuato` |
| Condiciones de pago | `Contado` |

Después, en el detalle del proveedor, dar de alta su material principal:

| Campo | Valor exacto |
|---|---|
| Material | `TEL-LON` (Loneta) |
| Precio de compra | `5000.00` |
| Mínimo de compra | `1.00` |
| Plazo en días | `7` |
| Proveedor principal | Sí |
| Activo | Sí |

Sin este paso, la cotización falla con `422 PROVEEDOR_NO_SURTE_MATERIAL`.

### 4.2 Verificar stock de materia prima (M15)

Ruta Angular: `/inventario-mp` · API: `GET /api/v1/inventario/material`.

Buscar `TEL-LON` / color `BL`. La semilla crea el registro de inventario pero con existencia 0. Los valores que verás son calculados por Flask: `fisico`, `reservado`, `disponible`, `en_compra`, `mínimo`, `punto de reorden`, `semáforo`. El semáforo estará en rojo mientras no haya lote recibido. Eso es correcto: la siguiente fase lo surte.

Si decides surtir con un ajuste directo en lugar de una compra (solo para acelerar la prueba):

```json
{
  "inventario_material_id": "<id de TEL-LON/BL>",
  "cantidad_contada": 75,
  "motivo": "Conteo inicial para prueba de producción"
}
```

`cantidad_contada` es el conteo absoluto, no un delta. Con `TEL-LON`, 1 rollo = 75 m² (`factor_compra_base` 75.00). Para `TEL-FEL` el factor es 64.80.

### 4.3 Desbloqueo: “la loneta necesita principal y alterno”

Ese mensaje **no es un requisito de Flask**. Verificado en el contrato real:

- `POST /api/v1/proveedores` valida solo identificación y contacto; no pide alterno.
- `POST /api/v1/proveedores/{id}/materiales` acepta `es_principal` y permite guardar sin que exista otro proveedor.
- `advertencias_cobertura()` solo emite avisos. Para `TEL-LON` ni siquiera avisa de alterno, porque no está en `MATERIALES_CRITICOS`.

Secuencia correcta para proseguir:

1. Entra con **ADMIN**. `/proveedores` y `/compras` son ADMIN-only; `/recepciones` también permite OPERATIVO. Si llegaste como Operativo, cambia de sesión antes de crear proveedores.
2. `/proveedores` → **+ Nuevo proveedor** → captura los campos de §4.1 → **Dar de alta**.
3. En la fila del proveedor pulsa **Catálogo** (`/proveedores/{id}/materiales`) → **+ Agregar material** → en el desplegable elige la opción **`Loneta`** (no busca el SKU `BO-UN-NG`: ese es un producto terminado y aquí solo aparecen materiales de M15). La unidad de compra se llena sola: `Rollo de 1.50 x 50.00 m = 75.00 m2`. Captura Precio cotizado, Mínimo `1.00`, Plazo acordado, **Principal = Sí**, **Activo = Sí** → **Guardar catálogo**.
4. Aunque arriba aparezca el aviso de cobertura, guarda: es informativo y no deshabilita el botón. Para continuar de inmediato, en `/compras/requisiciones` pulsa **Emitir orden directa**: toma el principal, crea y emite la orden en Flask. Si quieres comparación normal, crea el segundo proveedor **después** y asígnale `TEL-LON` con **Principal = No**; entonces usa **Cotizar**.
5. Continúa en `/recepciones` con la cabecera `Idempotency-Key` (§5.4).

Si aparece otro mensaje, sí es un bloqueo distinto: `Solo el Administrador puede modificar el padrón` → cambia a ADMIN; `El RFC ya está registrado` → usa otro RFC o déjalo vacío; `Catálogo de materiales no disponible` → M15 no respondió, pulsa **Reintentar**; `No hay proveedor principal disponible para emitir la orden directa` → marca **Principal = Sí** en el catálogo.

### 4.4 Causa raíz corregida: “Guardar catálogo” no respondía al agregar materiales

**Síntoma.** Con un proveedor que ya tenía materiales, agregar otra línea y pulsar **Guardar catálogo** no guardaba nada, o aparecía `MATERIAL_PROVEEDOR_NO_ENCONTRADO` (404). Con el primer material sí funcionaba.

**Causa real (verificada en `unique_api`).** Las rutas Flask son:

```text
PATCH  /api/v1/proveedores/{proveedor_id}/materiales/{material_id}
DELETE /api/v1/proveedores/{proveedor_id}/materiales/{material_id}
```

Aunque el parámetro se llama `material_id`, `_obtener_material()` resuelve con `db.session.get(ProveedorMaterial, id)`: espera el **id de la relación proveedor_material**, no el id del material de M15. Angular enviaba `materialId` (el de M15) en esas dos URLs. El 404 abortaba el `concatMap` completo, por lo que tampoco se creaba la línea nueva.

**Corrección aplicada en este repositorio.** `ProveedoresServicio.reemplazarMateriales()` ahora usa `ProveedorMaterial.id` para `PATCH` y `DELETE`, y `material_id` solo dentro del cuerpo JSON. Además:

- Si el material ya existió (aunque esté inactivo), se **reactiva con PATCH** en vez de reintentar un POST. MySQL tiene `uq_proveedor_material(proveedor_id, material_id)` y el DELETE de Flask solo desactiva; un POST duplicado devolvería `MATERIAL_PROVEEDOR_DUPLICADO` (409).
- `plazo_dias` ahora valida máximo 365, igual que `ProveedorMaterialCrearSchema`.
- La unidad de compra es de solo lectura: Flask la deriva de `Material.unidad_compra` e ignora cualquier valor enviado desde Angular.
- El aviso de validación ya es visible: al intentar guardar con una línea incompleta aparece un mensaje de error y un recuadro rojo, en lugar de no hacer nada.
- **Reintentar** recarga M15 y M13 juntos; antes solo recargaba M13 y el botón seguía deshabilitado si M15 no había respondido.

**Integridad confirmada con Flask.** El cuerpo enviado coincide con `ProveedorMaterialCrearSchema` / `ActualizarSchema`: `material_id`, `precio_compra`, `minimo_compra`, `plazo_dias`, `es_principal`, `vigencia_hasta`, `activo`. No se envía `unidad_compra` porque el esquema la excluye. No se requiere ningún cambio en Flask/MySQL.

**Segunda revisión (si todavía no guardaba).** Se corrigieron tres causas adicionales:

1. El `<select>` podía actualizar su control después del evento `(change)`, dejando la unidad de compra vacía y el formulario inválido sin mensaje claro. Ahora la unidad se sincroniza con `valueChanges` y se deriva de M15 al guardar; ya no es obligatoria como captura manual.
2. Al navegar de un proveedor a otro, Angular reutilizaba el componente y conservaba las líneas del proveedor anterior (`lineasInicializadas`). El id de la ruta ahora es reactivo y el formulario se limpia y se repuebla al cambiar de proveedor.
3. Si la caché local no traía una fila ya existente, el `POST` devolvía `MATERIAL_PROVEEDOR_DUPLICADO` (409). Angular ahora recupera el id real con `GET /proveedores/{id}/materiales` y reactiva la fila con `PATCH`.

Además, los errores 422 muestran el `detalle` campo por campo y cada línea inválida indica si falta material, precio o plazo. Si el guardado sigue fallando, copia el toast completo: ahora contiene el mensaje de Flask y los campos rechazados.

---

## 5. Fase 3 — M14 · Compras (ciclo completo)

Ruta Angular: `/compras` (Requisiciones, Cotizaciones, Órdenes de compra, Recepciones). Las recepciones también tienen acceso directo en `/recepciones`.  
ADMIN puede hacer todo en `/compras`; OPERATIVO solo entra a `/recepciones`. La captura de requisiciones por Operativo queda pendiente de que Flask defina su ruta y permisos (nota en `/compras/requisiciones`). Si estás en la sesión de Operativo, cambia a ADMIN antes de dar de alta proveedores o emitir compras.

### 5.1 Requisición

Campos exactos:

| Campo | Valor |
|---|---|
| Origen | `MANUAL` |
| Prioridad | `NORMAL` |
| Material / inventario | `TEL-LON` / `BL` |
| Cantidad base faltante | `75.0000` |
| Notas | `Reposición para pedidos en producción` |

```json
{
  "origen": "MANUAL",
  "prioridad": "NORMAL",
  "notas": "Reposición para pedidos en producción",
  "lineas": [
    {"inventario_material_id": "<id>", "cantidad_base_faltante": "75.0000"}
  ]
}
```

Folio generado con forma `REQ-2026-NNNNNN` (por ejemplo `REQ-2026-000001` si es el primero del año), estado `PENDIENTE`.

### 5.2 Cotización (ADMIN)

| Campo | Valor |
|---|---|
| Proveedor | `Textiles León SA de CV` |
| Plazo en días | `7` |
| Cantidad de compra | `1.00` (un rollo) |
| Precio unitario de compra | `5000.00` |

```json
{
  "proveedor_id": "<id del proveedor>",
  "plazo_dias": 7,
  "lineas": [
    {
      "requisicion_linea_id": "<id de la línea de la requisición>",
      "cantidad_compra": "1.00",
      "precio_unitario_compra": "5000.00"
    }
  ]
}
```

Después pulsa **Elegir** en la cotización. Se crea la orden en `BORRADOR` y la requisición pasa a `COMPRA_EMITIDA`.

### 5.3 Orden de compra y emisión

En Órdenes de compra, revisa el folio `OC-2026-NNNNNN`, proveedor, total `5000.00` y fecha prometida (hoy + 7 días). Pulsa **Emitir** (o `POST /ordenes-compra/{id}/emitir`, sin cuerpo). La orden pasa a `EMITIDA`. **No se puede recibir una orden en BORRADOR.**

### 5.4 Recepción (OPERATIVO o ADMIN)

| Campo | Valor exacto | Por qué |
|---|---|---|
| Orden de compra | la `OC-2026-NNNNNN` recién emitida | Debe estar `EMITIDA` o `PARCIAL` |
| Documento del proveedor | `FACT-001` | Hasta 60 caracteres |
| Línea / orden_compra_linea_id | id de la línea | — |
| Cantidad base medida | `75.0000` | 1 rollo × factor 75.00 |
| Cantidad base aceptada | `75.0000` | Todo se acepta en esta prueba |
| Cantidad base rechazada | `0.0000` | Si rechazas algo, debe cuadrar con la medida |
| Motivo de rechazo | vacío | Solo si hay rechazo: «Defecto de tela» |

**Clave de idempotencia (obligatoria):** `recepcion-prueba-2026-01`. Si repites la misma clave con el mismo cuerpo Flask devuelve la misma respuesta; con otro cuerpo da `409 IDEMPOTENCIA_CONFLICTO`. Usa una clave nueva para cada intento real.

```json
{
  "orden_compra_id": "<id OC>",
  "documento_proveedor": "FACT-001",
  "lineas": [
    {
      "orden_compra_linea_id": "<id línea OC>",
      "cantidad_base_medida": "75.0000",
      "cantidad_base_aceptada": "75.0000",
      "cantidad_base_rechazada": "0.0000"
    }
  ]
}
```

Resultado esperado: folio `REC-2026-NNNNNN`, orden `RECIBIDA`, lote `LT-2026-NNNNNN` con 75 m² y movimiento `ENTRADA`. En M15 el semáforo de `TEL-LON/BL` pasa a verde.

Si quieres provocar una merma de recepción para demostrar M17, usa medida `75.0000`, aceptada `70.0000`, rechazada `5.0000` y motivo `Defecto de tela`. La orden queda `PARCIAL` y se crea una merma en etapa `RECEPCION`.

---

## 6. Fase 4 — M10/M11 · Receta y publicación del producto

Rutas Angular: `/admin/recetas` (M11) y `/admin/productos` (M10). Solo ADMIN.

### 6.1 Receta vigente de la bolsa de tela

La semilla deja la receta `BO`/`UN` en `BORRADOR` **ya con sus líneas**. En M11 solo hay que revisarlas y activarla. Valores que trae la semilla (`scripts/seed.py`, receta `BO`/`UN`):

| Material / diseño | Cantidad neta | Merma % sembrada |
|---|---:|---:|
| `TEL-LON` (Loneta) | `0.3410` m² | `10.00` |
| `HIL-COS` | `11.6500` m | `10.00` |
| `EST-HOJ` | `1.0000` pieza | `0.00` |
| `ETQ-MAR` | `1.0000` pieza | `0.00` |
| `ETQ-COM-BO` | `1.0000` pieza | `0.00` |
| `DIS-006` (bordado bolsa 20 × 20 cm) | 1 aplicación | — |

Mano de obra, costo de bordado y costos indirectos quedan en `0.00` en la semilla. Si vas a mostrar costeo, captura `50.00`, `20.00` y `9.67` (valores del dataset real publicado). Para activar, Flask exige (`receta_service.py:669-704`): una tela o `HIL-EST`, `HIL-COS`, `ETQ-MAR` y `ETQ-COM-BO` (`ETQ-TAL-UN` **no** se exige en talla única) y mermas menores a 100. La semilla cumple todo eso.

Para agregar o corregir una línea:

```json
{"material_id": "<id TEL-LON>", "cantidad_neta": "0.3410", "factor_consumo": "1.000", "merma_pct": "10.00"}
```

Después `POST /api/v1/recetas/{id}/activar` (sin cuerpo). La receta pasa a `VIGENTE`.

**Si la base viene del dataset real publicado en lugar de la semilla**, la misma receta trae otros consumos (`TEL-LON` `0.0200`, `HIL-COS` `4.0000`, `EST-HOJ` `0.4500`, `ETQ-MAR` `0.0030`, `ETQ-COM-BO` `0.1000`) y precios `50.00 / 20.00 / 9.67`. No mezcles ambos juegos de valores en la misma base.

### 6.2 Publicar producto

Si el producto ya existe como borrador, en M10 hay que verificar que tenga imagen y receta vigente, y pulsar **Activar**. Requisitos que Flask valida (`producto_service.py:589-636`): que no esté activo, al menos una imagen y receta `VIGENTE` para cada talla con variantes. Si falta imagen: `422 IMAGEN_REQUERIDA`. La semilla deja el precio en `0.00`; asígnale un precio real antes de la venta (el dataset publicado usa `215.87`).

Datos reales del producto `BO`: nombre `Bolsa de tela`, precio `215.87`, variantes `BO-UN-BL`, `BO-UN-NG`, `BO-UN-GR`, composición `100% manta de algodón`, guía `Única, 40 × 35 cm`, permite bajo pedido `true`, mínimo `5`, reposición `20`.

**Pendiente real de corregir en Flask:** la imagen `BL`. La solución correcta es agregar la foto blanca real a `seed_uploads/`, registrarla en `datos_reales.json` con `color: BL` y `orden: 0`, y reordenar negra/gris a 1 y 2. No se resuelve desde Angular cuando la API está conectada.

---

## 7. Fase 5 — M16 · Producción y M12 · Stock del producto

Ruta Angular: `/produccion` · API base: `/api/v1/produccion`.

### 7.1 Crear orden de producción manual

| Campo | Valor |
|---|---|
| Línea / variante | `BO-UN-BL` (o la variante del pedido) |
| Cantidad | `2` unidades (enteras) |
| Fecha requerida | `2026-12-10` |
| Notas | `Prueba de producción para pedidos del cliente` |

```json
{
  "lineas": [{"variante_id": "<id de BO-UN-BL>", "cantidad": 2}],
  "fecha_requerida": "2026-12-10",
  "notas": "Prueba de producción para pedidos del cliente"
}
```

Resultado: folio `OP-2026-NNNNNN` (`OP-2026-000001` si es el primero del año), estado `PLANEADA`, con explosión de materiales desde la receta.

### 7.2 Reservar materiales

Pulsa **Reservar materiales** (`POST /produccion/ordenes/{id}/reservar`). Con el lote de 75 m² de `TEL-LON`, la orden debe pasar a `LISTA` y el semáforo a verde. Si queda en `PLANEADA` con semáforo rojo, falta material: usa **Solicitar compra de faltantes** y vuelve a la Fase 3.

### 7.3 Iniciar producción

Pulsa **Iniciar producción** con cabecera `Idempotency-Key: produccion-prueba-2026-01`. Estado: `EN_PROCESO`. El consumo de materiales es PEPS y queda registrado en el kardex.

```json
{}
```

### 7.4 Enviar a revisión y dictamen

```json
{"notas": "Revisión completa"}
```

Luego el dictamen (checklist todo en `true` para aprobar):

```json
{
  "lineas": [
    {
      "orden_linea_id": "<id de la línea de la orden>",
      "cantidad_revisada": 2,
      "cantidad_aprobada": 2,
      "cantidad_reproceso": 0,
      "cantidad_merma": 0,
      "medidas_ok": true,
      "costuras_ok": true,
      "bordado_ok": true,
      "etiquetas_ok": true,
      "observaciones": "Prueba aprobada"
    }
  ]
}
```

Resultado esperado: orden `CERRADA`, 2 unidades en M12 con movimiento `PRODUCCION`, y asignación FIFO a los pedidos que esperaban esa variante. Si aprobadas + merma no cuadra con lo planeado, la orden queda en revisión o vuelve a proceso.

### 7.5 Verificar el stock en M12

Ruta Angular: `/operacion/inventario-pt` · API: `GET /api/v1/inventario/producto?sku=BO-UN-BL`.

Debe aparecer `existencia = 2`, `reservado` según los pedidos asignados, `disponible = existencia - reservado`, movimiento `PRODUCCION` en `/inventario/producto/movimientos`. Si los dos pedidos seguían en `EN_PRODUCCION`, el dictamen los deja `CONFIRMADO` y el `reservado` sube.

---

## 8. Fase 6 — M09 · Pedidos: localizar los dos pedidos en producción

**Ruta Angular:** `/admin/pedidos` · **Rol:** ADMIN edita, OPERATIVO solo consulta. 
**Contratos Flask:** `GET /pedidos`, `GET /pedidos/pendientes-produccion`, `GET /pedidos/{id}`, `PATCH /pedidos/{id}`, `POST /pedidos/{id}/cancelar`.

### 8.1 Encontrar los dos pedidos del usuario

1. Entra con la cuenta ADMIN y abre `/admin/pedidos`.
2. En **Bandeja de pedidos**, en el buscador escribe el folio (`UNQ-...`), el cliente o el SKU. En el selector **Estado** elige `En producción`.
3. Alterna entre **Tablero** y **Lista**. En cada tarjeta apunta: folio, cliente, artículos y el tiempo en el estado con su semáforo (verde dentro del umbral, ámbar al 75 % y rojo al superarlo). Para `EN_PRODUCCION` el umbral es 168 horas (7 días).
4. Abre **Ver demanda pendiente** (`/admin/pedidos/pendientes-produccion`) y busca el mismo SKU. Deben aparecer: SKU, prenda, talla, color, demanda total, orden vinculada (`OP-...`) y fecha estimada.
5. Pulsa el folio para abrir `/admin/pedidos/<folio>` y anota los cuatro indicadores: **Artículos**, **Reservadas**, **Pendientes** y **Preparadas**. En la tabla de líneas verifica que `Cant. = Reservada + Pendiente`.

**Qué poner en el detalle (solo si hace falta):**

| Control | Valor | Regla real |
|---|---|---|
| Prioridad | `Alta` para el pedido más antiguo; `Normal` para el otro | ADMIN; Flask rechaza el cambio solo si está `CANCELADO` (`409 PEDIDO_CANCELADO`). Evita cambiar uno ya entregado en la demo |
| Nota interna | `Verificar talla con la clienta antes del empaque` | Mínimo 5 caracteres en la interfaz; Flask acepta 1–500 y la guarda como evento invisible al cliente |
| Cancelar pedido | Solo si el profesor pide probar cancelación: motivo `Pedido duplicado en la prueba` | 3–300 caracteres; permitido en RECIBIDO, CONFIRMADO, EN_PRODUCCION, EN_PREPARACION y LISTO_ENVIO |

**No hagas clic en «Crear o ajustar orden» esperando que cree algo:** en la implementación actual ese botón solo muestra un aviso de que la acción queda pendiente de la integración con Flask. Las órdenes se crean en `/produccion` (Fase 5).

**Error en vivo más probable:** si los dos pedidos siguen en `EN_PRODUCCION`, **no aparecerán en la cola de preparación**. Eso no es un fallo: M18 solo recibe pedidos `CONFIRMADO`. Primero hay que cerrar la orden de producción con dictamen (§7.4), que asigna las unidades aprobadas a los pedidos FIFO y los deja `CONFIRMADO`.

Verificación por API (opcional, con token de ADMIN):

```bash
curl.exe -H "Authorization: Bearer <access_token>" "http://localhost:8001/api/v1/pedidos?estado=EN_PRODUCCION"
curl.exe -H "Authorization: Bearer <access_token>" "http://localhost:8001/api/v1/pedidos/pendientes-produccion"
```

---

## 9. Fase 7 — M18 · Preparación

**Ruta Angular:** `/panel-admin/preparacion` (pestañas **Cola** e **Incidencias**) · **Rol:** OPERATIVO o ADMIN. 
**Contratos Flask:** `/api/v1/preparacion/cola`, `/tomar`, `/lineas`, `/incidencia`, `/empacar`, `/etiqueta`.

### 9.1 Cola y toma del pedido

| Paso | Acción exacta en pantalla | Resultado esperado |
|---|---|---|
| 1 | Pulsar **↻ Actualizar** | Carga solo pedidos `CONFIRMADO`, ordenados por prioridad ALTA primero y luego fecha prometida |
| 2 | En **Buscar folio o destinatario...** escribir el folio del pedido | Queda una sola tarjeta |
| 3 | Pulsar **Tomar pedido** | Preparación `EN_PICKING` y pedido `EN_PREPARACION`; se cierra la alerta `PEDIDO_ESTANCADO` |
| 4 | Si la tarjeta ya está tomada, pulsar **Abrir** | Muestra la hoja sin volver a tomarla |

Si la cola dice «No hay registros para esta vista», vuelve a §7.4: la producción aún no entregó unidades al pedido.

### 9.2 Picking

| Campo / control | Qué poner | Regla |
|---|---|---|
| `SKU a surtir` (placeholder «SKU del pedido») | `BO-UN-BL` (el SKU exacto de la línea) | Un SKU ajeno se rechaza: «El SKU … no está en el pedido …. Escaneo rechazado.» |
| Botón **Surtir 1 pza** | Pulsar una vez por unidad | Incrementa `Surtida` en 1 |
| Columna **SURTIDA** | `1`, `2`… hasta igualar **REQUERIDA** | Entero entre 0 y la cantidad requerida |

Cuando todas las líneas tienen `Surtida = Requerida`, la hoja pasa sola a `EN_VERIFICACION`.

### 9.3 Verificación, empaque y etiqueta

| Casilla (columna) | Marcar | Momento |
|---|---|---|
| **SKU OK** | ✔ | Solo cuando el estado es `EN_VERIFICACION` |
| **DISEÑO** | ✔ | Ídem; confirma diseño y bordado |
| **ETIQUETAS** | ✔ | Ídem |

Con las tres verificaciones y cantidades mayores que cero, la hoja pasa a `EN_EMPAQUE`. En el bloque **Empaque por pedido** debe quedar la lista: bolsa individual por prenda, papel protector por prenda, tarjeta con código QR y etiqueta de envío por pedido.

| Botón | Cuándo pulsarlo | Efecto real |
|---|---|---|
| **Imprimir etiqueta PDF** | Antes de cerrar | PDF `inline` con folio, destinatario, dirección, CP, teléfono y QR `UNIQUE:<folio>` |
| **Empacar y marcar listo** | Con todo marcado | Consume los materiales de empaque por PEPS, hoja `LISTA` y pedido `LISTO_ENVIO` |

### 9.4 Incidencia (solo si quieres demostrar M17/M21)

En el bloque **Incidencia de preparación**:

| Campo | Valor de prueba | Regla |
|---|---|---|
| Línea | La línea `BO-UN-BL` del pedido | Debe ser del pedido abierto |
| Tipo | `CANTIDAD` (o `SKU`, `CALIDAD`) | — |
| Cantidad | `1` | Solo aparece si el tipo es `CALIDAD`; entero ≥ 1 |
| Descripción | `Falta una unidad del SKU solicitado` | 3–500 caracteres |
| Botón | **Registrar incidencia** | Reinicia verificaciones y devuelve la hoja a `EN_PICKING`; si es `CALIDAD` genera merma y el pedido vuelve a `EN_PRODUCCION` |

Para la demo normal **no registres incidencias**.

---

## 10. Fase 8 — M19 · Entregas

**Ruta Angular:** `/panel-admin/entregas` · **Rol:** ADMIN y OPERATIVO; la pestaña **Repartidores** es solo ADMIN. 
**Contratos Flask:** `/api/v1/entregas`, `/entregas/{id}/salida`, `/entregas/{id}/resultado`, `/repartidores`.

### 10.1 Alta del repartidor (ADMIN)

Pestaña **Repartidores** → formulario:

| `formControlName` / etiqueta | Valor exacto | Validación visible |
|---|---|---|
| Nombre completo | `Juan Pérez` | 2–100 caracteres |
| Teléfono | `1234567890` | Exactamente 10 dígitos |
| Vehículo | `Motocicleta` | Máximo 60 caracteres |
| Activo | Marca ✔ | — |
| Botón | **Agregar repartidor** | — |

Si el formulario marca error en teléfono, revisa que sean 10 dígitos sin espacios ni guiones.

### 10.2 Asignar la entrega

Pestaña **Por asignar** (solo pedidos `LISTO_ENVIO`):

| Filtro / control | Valor exacto | Regla |
|---|---|---|
| Código postal | `37000` | 5 dígitos; la tarifa semilla cubre `37000`–`37999` |
| Repartidor | `Juan Pérez` | Debe estar activo |
| Fecha programada | La fecha de hoy (se precarga) | No puede ser pasada |
| Notas | `Ruta centro León` | Opcional |
| Ordenar por | `Código postal` | También disponible `Prioridad` y `Fecha prometida` |
| Botón de la fila | **Asignar** | Crea folio `EN-2026-...`, estado `PROGRAMADA`, intento `1` |

Payload equivalente (sustituye la fecha por el día real de la prueba; aquí se muestra el 28 de noviembre de 2026):

```json
{
  "pedido_id": "<id del pedido>",
  "repartidor_id": "<id de Juan Pérez>",
  "fecha_programada": "2026-11-28",
  "notas": "Ruta centro León"
}
```

### 10.3 Hoja de reparto y salida

1. Pestaña **Hoja de reparto** → Repartidor `Juan Pérez`, Fecha = hoy, botón **Generar PDF**. La fecha debe ser igual o posterior a hoy.
2. Pestaña **Seguimiento** → en la fila de la guía `EN-...` pulsa **Confirmar salida**. La entrega pasa a `EN_RUTA`, el pedido a `EN_REPARTO` y Flask descuenta la existencia con movimiento `SALIDA_ENVIO`.

**Estado del historial:** Angular consume `GET /api/v1/entregas` y reconstruye **Seguimiento** desde MySQL, así que la guía `EN-...` persiste al recargar o cambiar de navegador. Ese endpoint debe publicarse en Flask (prompt de cambios en `unique_api`); mientras no exista, la vista degrada a las asignaciones de la sesión y lo indica con el aviso «Historial no disponible en la API...». En ese caso haz asignación → salida → resultado sin recargar y anota el folio `EN-...`.

### 10.4 Registrar el resultado

En la fila `EN_RUTA`, pulsa **Entregado** y completa:

| Control | Valor exacto | Regla |
|---|---|---|
| Entregado | ✔ (marcado) | — |
| Receptor | `María López` | Quién recibió físicamente |
| Notas | `Entregado en domicilio, 12:30` | Opcional |
| Botón | **Guardar resultado** | Entrega `ENTREGADA`, pedido `ENTREGADO`, se guarda hora y se abre la ventana de devolución |

Para probar un fallo, pulsa **Fallida** y elige:

| Motivo | Cuándo |
|---|---|
| `AUSENTE` | No estaba nadie |
| `DIRECCION_INCORRECTA` | No se encontró el domicilio |
| `RECHAZADO` | El cliente rechazó el paquete |
| `OTRO` | Otro caso |

El fallo reingresa las prendas con movimiento `REINGRESO`, devuelve el pedido a `LISTO_ENVIO` y abre la alerta `ENTREGA_FALLIDA`. Al segundo fallo la alerta se eleva a `CRITICA` (parámetro `max_intentos_entrega = 2`) y el Administrador decide reprogramar o cancelar con reembolso.

### 10.5 Reporte final

Pestaña **Productos repartidos**: Repartidor `Juan Pérez`, Desde/Hasta = periodo de hoy. Deben aparecer el SKU, el producto, las unidades y el número de pedidos. El PDF de la hoja y este reporte son la prueba visible de la entrega para el profesor.

---

## 11. Fase 9 — Verificación desde la cuenta del cliente (M06)

**Ruta Angular:** `/pedidos` y `/pedidos/:id` · **Rol:** CLIENTE. 
**Contratos Flask:** `GET /mis-pedidos`, `GET /mis-pedidos/{id}`, `GET /mis-pedidos/{id}/comprobante`.

| Pantalla | Qué revisar | Resultado esperado |
|---|---|---|
| **Mis pedidos** (`/pedidos`) | Filtros `Todos`, `En proceso`, `Enviados`, `Entregados` | Los dos pedidos aparecen con folio, fecha, artículos, total y chip `Entregado` |
| **Seguimiento** (`/pedidos/<folio>`) | Línea de tiempo | `Pedido recibido → Pedido confirmado → En producción → Verificado → Enviado → Entregado`, con fecha y hora |
| **Seguimiento** | Guía y repartidor | Guía `EN-2026-...` (misma que en M19) y, en reparto, nombre y teléfono de `Juan Pérez` |
| **Seguimiento** | Artículos | Subtotal, descuento, envío y total en MXN (`$215.87`, `$200.00`) |
| **Descargar comprobante digital** | Botón | Usa `/mis-pedidos/{id}/comprobante`; devuelve líneas y totales |
| **Cambio / devolución** | Botón | Solo visible si está `ENTREGADO` y dentro de 15 días |

Correspondencia de estados que debe ver el cliente: `LISTO_ENVIO = Verificado`, `EN_REPARTO = Enviado`, `ENTREGADO = Entregado`. La pantalla se actualiza cada 30 segundos.

---

## 12. Cierre y evidencia en M20/M21/M22

| Vista | Ruta | Qué debe mostrarse |
|---|---|---|
| Dashboard | `/panel-admin/dashboard` | Pedidos activos/entregados, órdenes activas, alertas abiertas, variantes bajo mínimo, mermas y costo de mermas |
| Alertas | `/panel-admin/alertas` | `PEDIDO_ESTANCADO` se cierra al tomar el pedido; `ENTREGA_FALLIDA` solo si hubo fallo; `/panel-admin/alertas/resueltas` muestra `RESUELTA_AUTO`, no las atendidas |
| Bitácora | `/panel-admin/sistema/bitacora` | `LOGIN`, altas de usuario, cambios de configuración, recepción, producción, empaque y entrega |

Filtros reales de bitácora: `accion`, `entidad`, `usuario_id`, `desde`, `hasta`.

---

## 13. Tabla de errores en vivo y qué significan

| Síntoma en pantalla | Causa real | Acción correcta |
|---|---|---|
| «Configuración inicial pendiente en la API» en M22 | La tabla `configuracion` está vacía; el pre-deploy no siembra | `docker compose exec api python -m scripts.seed` |
| `401 NO_AUTENTICADO` / `SESION_EXPIRADA` | Token vencido (15 min) o cuenta no `ACTIVA` | Renovar con `POST /auth/refrescar` (cookie + `X-CSRF-TOKEN`) o volver a iniciar sesión |
| `403 PERMISO_INSUFICIENTE` | Rol incorrecto: OPERATIVO no hace cotizaciones, OC, M22 ni repartidores; CLIENTE solo su ámbito | Entrar con ADMIN u OPERATIVO según la fase |
| `400 VALIDACION` con `detalle[{campo,mensaje}]` | Campo mal escrito o desconocido (ej. `correo` en `PATCH /usuarios/{id}`) | Corregir ese campo; no reintentar igual |
| `409 IDEMPOTENCIA_CONFLICTO` en recepción/inicio/pago | Misma clave con cuerpo distinto o distinto usuario | Usar una clave nueva; repetir la misma solo con el cuerpo idéntico devuelve la respuesta cacheada |
| `409 ESTADO_INVALIDO` al recibir | La OC está en `BORRADOR` | Pulsar **Emitir** antes de recibir |
| `422 CANTIDADES_NO_CONCUADRAN` | `aceptada + rechazada != medida` | Ajustar las tres cantidades |
| `422 PROVEEDOR_NO_SURTE_MATERIAL` | Falta el alta de proveedor-material con `activo=true` | Alta en `/proveedores` → materiales |
| `422 RECETA_NO_VIGENTE` al activar producto | Falta imagen o receta vigente por talla | Completar receta en `/admin/recetas` y activar producto en `/admin/productos` |
| `422 IMAGEN_REQUERIDA` | Producto sin imagen en MySQL | Subir imagen real; no se resuelve desde Angular |
| `422 RECETA_SIN_TELA`, `RECETA_SIN_HILO_COSTURA`, `ETIQUETAS_INCOMPLETAS` | Faltan líneas obligatorias de la receta | Agregar `TEL-LON`, `HIL-COS`, `ETQ-MAR`, `ETQ-COM-BO` |
| `409 MATERIAL_INSUFICIENTE` al iniciar | No hay lotes disponibles | Reservar de nuevo o solicitar compra y recibir (Fase 3) |
| Cola de M18 vacía | Pedidos siguen en `EN_PRODUCCION` | Cerrar la orden con dictamen (§7.4) |
| «No hay registros» en M19 → Por asignar | Pedidos no están `LISTO_ENVIO` | Terminar empaque en M18 (§9.3) |
| La fila de seguimiento desaparece al recargar | Flask aún no publica `GET /entregas` y Angular cae al historial de sesión | Aplicar el cambio backend; mientras tanto, no recargar entre asignar, salida y resultado y anotar folio `EN-...` e id |
| Bolsa negra en el catálogo conectado a Flask | `datos_reales.json` publica imágenes solo para `NG` y `GR`; el principal toma `galeria[0]` | Corregir el dataset/imagen `BL` en Flask. El cambio de `catalogo-oficial.ts` solo aplica al modo demostración Angular |
| `409 CODIGO_SKU_INMUTABLE` al editar catálogo | Se intentó cambiar `BL`, `CH` o `BO` ya usados en SKU | Solo desactivar; no renombrar |
| `409 CATALOGO_EN_USO` al borrar | El catálogo tiene productos, variantes, materiales o mermas | No borrar: desactivar |
| `429 DEMASIADOS_INTENTOS` | Límite de peticiones | Esperar y reintentar; no es un error de negocio |

---

## 14. Límites que no se deben cruzar en la presentación

- No hay backend en este repositorio Angular: todo lo anterior ocurre en Flask/MySQL. Angular solo muestra y envía contratos.
- No se inventan endpoints, folios ni precios: los folios `UNQ`, `REQ`, `OC`, `REC`, `LT`, `OP`, `EN` y los SKU los genera el servidor.
- No se guarda PAN ni CVV; el pago simulado conserva solo `ultimos4`, titular y referencia.
- Los movimientos de inventario son inmutables: una corrección es otro movimiento, nunca editar el anterior.
- Los costos, precios de compra y utilidades no se muestran a OPERATIVO: los esquemas de Flask los omiten.
- Las prendas se cuentan en unidades enteras; los materiales se mueven en unidades base (m², m, piezas).
- Los valores marcados como «propuesta» en M22 (`dias_devolucion`, `max_intentos_entrega`, `dias_produccion_estandar`) no son decisiones confirmadas: preséntalos como parámetros configurables.

---

## 15. Orden resumido para el día de la prueba

1. `docker compose exec api python -m scripts.seed` y verificar `/api/v1/health/db`.
2. Crear ADMIN y OPERATIVO; dar de alta CLIENTE en M22.
3. M22: confirmar parámetros, catálogos y tarifa `37000`–`37999`.
4. `/proveedores`: alta de proveedor + material `TEL-LON` como principal.
5. `/compras`: requisición → cotización → elegir → emitir → recepción con `Idempotency-Key`.
6. `/inventario-mp`: confirmar lote y semáforo en verde.
7. `/admin/recetas` y `/admin/productos`: completar receta `BO/UN`, activar receta y publicar producto.
8. `/produccion`: crear OP → reservar → iniciar → revisión → dictamen; verificar `/operacion/inventario-pt`.
9. `/admin/pedidos`: localizar los dos pedidos en producción y anotar folios, SKU, OP y pendientes.
10. `/panel-admin/preparacion`: tomar → surtir → verificar → empacar.
11. `/panel-admin/entregas`: alta de repartidor → asignar → hoja PDF → salida → resultado.
12. `/pedidos` con la cuenta CLIENTE: confirmar línea de tiempo, guía y comprobante.
13. `/panel-admin/dashboard`, `/panel-admin/alertas` y `/panel-admin/sistema/bitacora` como evidencia final.
