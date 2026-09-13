import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'internalRouteHref',
  standalone: true,
})
export class InternalRouteHrefPipe implements PipeTransform {
  transform(route: string | null | undefined): string | null {
    if (!route) return null;
    if (/^(?:[a-z]+:|#)/i.test(route)) return route;

    return `/#${route.startsWith('/') ? route : `/${route}`}`;
  }
}
