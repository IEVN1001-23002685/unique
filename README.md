# Unique

IEVN1001

Páramo García Julia Paola
23002754
86609@alumnos.utleon.edu.mx

Reyna Guerra Angel Saúl
23002685
86685@alumnos.utleon.edu.mx

Santillan Martinez Diana Teresa
22002091 
78960@alumnos.utleon.edu.mx

Solis Ortega Luna Amaité
23001069
83825@alumnos.utleon.edu.mx

Zamora Muñoz Alma Paola
22001498
79021@alumnos.utleon.edu.mx

## Acceso real

No hay perfil de demostración ni atajo de sesión. `AuthSessionService` envía
`{ correo, password }` a `/api/v1/auth/login` y guarda en memoria el `access_token` y el
`usuario.rol` devueltos por Flask. De ese rol real dependen el menú, las etiquetas y los guards:
`CLIENTE` vuelve al catálogo, mientras que `OPERATIVO` y `ADMIN` entran al panel (`ADMIN`
también satisface los permisos de `OPERATIVO`). El token no se escribe en `localStorage` ni en
`sessionStorage`; el refresco usa la cookie `httpOnly`.

Las cuentas de los tres roles se dan de alta en el panel M22 mediante `POST /api/v1/usuarios`,
con contraseña elegida por el administrador. Para la primera cuenta, use `ADMIN_EMAIL`/
`ADMIN_PASSWORD` o `scripts/create_admin` en la API; no hay contraseñas fijas en este repo.
