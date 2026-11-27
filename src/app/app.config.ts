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
    provideAppInitializer(() => inject(ApiConfigService).cargar()),
    provideAppInitializer(() => inject(AuthSessionService).hidratar()),
    // Los guards encuentran data.roles también en las rutas hijas (§10.2).
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),
  ],
};
