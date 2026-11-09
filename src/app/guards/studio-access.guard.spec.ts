import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { studioAccessGuard } from './studio-access.guard';
import { SupabaseService } from '../services/supabase.service';

describe('studioAccessGuard', () => {
  let mockSupabase: Partial<SupabaseService>;

  beforeEach(() => {
    mockSupabase = {
      currentUser: signal<User | null>(null),
      isAuthenticated: signal<boolean>(false)
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });
  });

  it('debe retornar true en Fase 1 para permitir acceso libre al Estudio 3D', () => {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/studio' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => studioAccessGuard(route, state));
    expect(result).toBe(true);
  });
});
