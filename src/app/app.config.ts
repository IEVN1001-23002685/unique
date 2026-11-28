import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { provideRouter, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { ApiConfigService } from './core/api/api-config.service';
import { AuthSessionService } from './core/auth/auth-session.service';
import { authInterceptor } from './core/auth/auth.interceptor';

// Datos de locale necesarios para dar formato a MXN y fechas en español de México.
registerLocaleData(localeEsMx);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Un único initializer: los initializers de Angular pueden ejecutarse en paralelo,
    // por lo que hidratar la sesión debe esperar a que la URL de la API esté lista.
    provideAppInitializer(async () => {
      const config = inject(ApiConfigService);
      const sesion = inject(AuthSessionService);
      await config.cargar();
      await sesion.hidratar();
    }),
    // Los guards encuentran data.roles también en las rutas hijas (§10.2).
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),
  ],
};
