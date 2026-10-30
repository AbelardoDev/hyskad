import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  provideTranslocoScope,
  translateSignal,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { IDIOMAS, LanguageService } from '../../core/i18n/language.service';
import { PreferenciaTema, ThemeService } from '../../core/theme/theme.service';
import { CopPipe, FechaPipe, TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import { HkAvatar } from '../../shared/ui/avatar/avatar';
import { HkBadge, TonoBadge } from '../../shared/ui/badge/badge';
import {
  EstadoOrden,
  ESTILO_ESTADO_ORDEN,
  HkStatusBadge,
} from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkIconButton } from '../../shared/ui/button/icon-button';
import { HkCard } from '../../shared/ui/card/card';
import { HkStatCard } from '../../shared/ui/card/stat-card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkDropdownMenu, ItemMenu } from '../../shared/ui/dropdown-menu/dropdown-menu';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { FiltroActivo, HkFilterBar } from '../../shared/ui/filter-bar/filter-bar';
import { HkCheckbox } from '../../shared/ui/forms/checkbox';
import { HkCombobox, OpcionCombobox } from '../../shared/ui/forms/combobox';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkSwitch } from '../../shared/ui/forms/switch';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { HkLogo } from '../../shared/ui/logo/logo';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { HkStepper, Paso } from '../../shared/ui/stepper/stepper';
import { HkTabs, Pestana } from '../../shared/ui/tabs/tabs';
import { ColumnaTabla, HkCelda, HkTable, OrdenTabla } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast';
import { HkTooltipDirective } from '../../shared/ui/tooltip/tooltip';
import { DemoDrawer, DemoModal } from './ui-galeria-demos';

interface OrdenDemo {
  id: number;
  numero: string;
  placa: string;
  cliente: string;
  estado: EstadoOrden;
  total: number;
  ingreso: string;
}

const CLIENTES = [
  'Andrea Martínez',
  'Luis Pérez',
  'Camila Rojas',
  'Jorge Herrera',
  'Valentina Gómez',
  'Santiago Díaz',
];
const ESTADOS = Object.keys(ESTILO_ESTADO_ORDEN) as EstadoOrden[];
const ORDENES: OrdenDemo[] = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  numero: `OT-${String(i + 1).padStart(6, '0')}`,
  placa: `${['ABC', 'XYZ', 'KLM', 'QWE'][i % 4]}${String(10 + i).padStart(2, '0')}${'DEFGH'[i % 5]}`,
  cliente: CLIENTES[i % CLIENTES.length],
  estado: ESTADOS[i % ESTADOS.length],
  total: 85000 + ((i * 137_500) % 1_900_000),
  ingreso: new Date(Date.UTC(2026, 9, 1 + (i % 28), 14)).toISOString(),
}));
const TAMANO_PAGINA = 5;

/** Galería del kit (`/dev/ui`): todos los componentes y variantes, con selector de tema e idioma. */
@Component({
  selector: 'hk-ui-galeria-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    LucideDynamicIcon,
    CopPipe,
    FechaPipe,
    TiempoRelativoPipe,
    HkAvatar,
    HkBadge,
    HkStatusBadge,
    HkButton,
    HkIconButton,
    HkCard,
    HkStatCard,
    HkDropdownMenu,
    HkEmptyState,
    HkFilterBar,
    HkCheckbox,
    HkCombobox,
    HkDateInput,
    HkFormField,
    HkInput,
    HkMoneyInput,
    HkSelect,
    HkSwitch,
    HkTextarea,
    HkLogo,
    HkPageHeader,
    HkSkeleton,
    HkStepper,
    HkTabs,
    HkTable,
    HkCelda,
    HkTooltipDirective,
  ],
  providers: [provideTranslocoScope('dev-ui')],
  templateUrl: './ui-galeria-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiGaleriaPage {
  protected readonly tema = inject(ThemeService);
  protected readonly idioma = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly temas: readonly { id: PreferenciaTema; icono: string }[] = [
    { id: 'system', icono: 'monitor' },
    { id: 'light', icono: 'sun' },
    { id: 'dark', icono: 'moon' },
  ];
  protected readonly idiomas = IDIOMAS;

  // Colores
  protected readonly escala = [
    '50',
    '100',
    '200',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    '900',
    '950',
  ];
  protected readonly navy = ['navy-900', 'navy-950', 'navy-975', 'accent'];
  protected readonly semanticos = [
    'bg',
    'surface',
    'surface-2',
    'border',
    'border-strong',
    'fg',
    'muted',
    'primary',
    'primary-hover',
    'ring',
  ];
  protected readonly tonos: readonly TonoBadge[] = [
    'neutral',
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'accent',
  ];
  protected readonly estados = ESTADOS;

  // Formulario
  protected readonly formulario = this.fb.group({
    nombre: this.fb.control('', [Validators.required, Validators.minLength(3)]),
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required, Validators.minLength(8)]),
    documento: this.fb.control<string | null>(null, Validators.required),
    moto: this.fb.control<string | null>(null, Validators.required),
    fecha: this.fb.control<string | null>(null, Validators.required),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(1000)]),
    observaciones: this.fb.control(''),
    acepta: this.fb.control(false, Validators.requiredTrue),
    notificar: this.fb.control(true),
  });
  private readonly textosDocumento = translateSignal(
    ['CC', 'CE', 'NIT', 'PA'].map((t) => `form.tipos.${t}`),
  );
  protected readonly tiposDocumento = computed<OpcionSelect[]>(() =>
    ['CC', 'CE', 'NIT', 'PA'].map((valor, i) => ({ valor, etiqueta: this.textosDocumento()[i] })),
  );
  protected readonly motos: OpcionCombobox[] = [
    { valor: 'ABC12D', etiqueta: 'ABC12D', descripcion: 'Yamaha NMAX 155 · 2023' },
    { valor: 'XYZ34E', etiqueta: 'XYZ34E', descripcion: 'Honda CB 190R · 2022' },
    { valor: 'KLM56F', etiqueta: 'KLM56F', descripcion: 'Suzuki Gixxer 150 · 2021' },
    { valor: 'QWE78G', etiqueta: 'QWE78G', descripcion: 'Bajaj Pulsar NS 200 · 2024' },
    { valor: 'RTY90H', etiqueta: 'RTY90H', descripcion: 'AKT NKD 125 · 2020' },
  ];

  // Tabla
  private readonly textosColumnas = translateSignal(
    ['numero', 'placa', 'cliente', 'estado', 'ingreso', 'total'].map((c) => `tabla.${c}`),
  );
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [numero, placa, cliente, estado, ingreso, total] = this.textosColumnas();
    return [
      { clave: 'numero', etiqueta: numero, ordenable: true, principal: true },
      { clave: 'placa', etiqueta: placa },
      { clave: 'cliente', etiqueta: cliente, ordenable: true },
      { clave: 'estado', etiqueta: estado },
      { clave: 'ingreso', etiqueta: ingreso, ordenable: true, ocultarEnMovil: true },
      { clave: 'total', etiqueta: total, ordenable: true, numerica: true },
    ];
  });
  protected readonly tablaCargando = signal(false);
  protected readonly tablaVacia = signal(false);
  protected readonly busqueda = signal('');
  protected readonly orden = signal<OrdenTabla | null>({ columna: 'numero', direccion: 'desc' });
  protected readonly pagina = signal(0);
  protected readonly seleccion = signal<readonly unknown[]>([]);
  protected readonly filtroEstado = signal(true);
  protected readonly tamanoPagina = TAMANO_PAGINA;
  private readonly filtradas = computed(() => {
    if (this.tablaVacia()) return [];
    const texto = this.busqueda().toLowerCase();
    let filas = ORDENES.filter(
      (o) => !texto || `${o.numero} ${o.placa} ${o.cliente}`.toLowerCase().includes(texto),
    );
    if (this.filtroEstado()) filas = filas.filter((o) => o.estado !== 'CANCELADA');
    const orden = this.orden();
    if (orden) {
      const clave = orden.columna as keyof OrdenDemo;
      filas = [...filas].sort(
        (a, b) =>
          (a[clave] < b[clave] ? -1 : a[clave] > b[clave] ? 1 : 0) *
          (orden.direccion === 'asc' ? 1 : -1),
      );
    }
    return filas;
  });
  protected readonly totalFilas = computed(() => this.filtradas().length);
  protected readonly filas = computed(() =>
    this.filtradas().slice(this.pagina() * TAMANO_PAGINA, (this.pagina() + 1) * TAMANO_PAGINA),
  );
  private readonly textoFiltroEstado = translateSignal('tabla.filtro_estado');
  protected readonly filtros = computed<FiltroActivo[]>(() =>
    this.filtroEstado() ? [{ clave: 'estado', etiqueta: this.textoFiltroEstado() }] : [],
  );

  // Pestañas y stepper
  private readonly textosPestanas = translateSignal(
    ['resumen', 'diagnostico', 'items', 'historial'].map((p) => `navegacion.${p}`),
  );
  protected readonly pestanas = computed<Pestana[]>(() => {
    const [resumen, diagnostico, items, historial] = this.textosPestanas();
    return [
      { id: 'resumen', etiqueta: resumen, icono: 'eye' },
      { id: 'diagnostico', etiqueta: diagnostico, icono: 'stethoscope' },
      { id: 'items', etiqueta: items, icono: 'package', contador: 4 },
      { id: 'historial', etiqueta: historial, icono: 'clipboard-list', deshabilitada: true },
    ];
  });
  protected readonly pestanaActiva = signal('resumen');
  protected readonly etiquetaPestanaActiva = computed(
    () => this.pestanas().find((p) => p.id === this.pestanaActiva())?.etiqueta ?? '',
  );
  // Claves globales: `translateSignal` las prefijaría con el scope de la página.
  private readonly textosEstados = toSignal(
    this.transloco.selectTranslate<string[]>(ESTADOS.slice(0, 6).map((e) => `estados.orden.${e}`)),
    { initialValue: [] },
  );
  protected readonly pasos = computed<Paso[]>(() =>
    ESTADOS.slice(0, 6).map((estado, i) => ({
      id: estado,
      etiqueta: this.textosEstados()[i],
      icono: ESTILO_ESTADO_ORDEN[estado].icono,
      detalle: i < 3 ? `0${i + 2}/10 · 09:${i}5` : undefined,
    })),
  );
  protected readonly ordenCancelada = signal(false);

  // Menú de ejemplo
  private readonly textosMenu = translateSignal(['botones.editar', 'botones.eliminar']);
  protected readonly itemsMenu = computed<ItemMenu[]>(() => [
    { id: 'editar', etiqueta: this.textosMenu()[0], icono: 'pencil' },
    { id: 'descargar', etiqueta: 'PDF', icono: 'download' },
    {
      id: 'eliminar',
      etiqueta: this.textosMenu()[1],
      icono: 'trash',
      peligro: true,
      separadorAntes: true,
    },
  ]);

  // Formato
  protected readonly ahora = new Date();
  protected readonly haceUnRato = new Date(Date.now() - 5 * 60 * 1000);
  protected readonly ayer = new Date(Date.now() - 26 * 3600 * 1000);

  protected enviarFormulario(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.valid) this.toasts.exito(this.t('form.valido'));
  }

  protected simularErrorServidor(): void {
    const control = this.formulario.controls.nombre;
    control.setErrors({ servidor: 'DOCUMENTO_INVALIDO' });
    control.markAsTouched();
  }

  protected alBuscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(0);
  }

  protected abrirModal(): void {
    this.dialogos.abrirModal(DemoModal);
  }

  protected abrirDrawer(): void {
    this.dialogos.abrirDrawer(DemoDrawer);
  }

  protected async confirmar(peligrosa: boolean): Promise<void> {
    const resultado = await this.confirmacion.pedir(
      peligrosa
        ? {
            titulo: this.t('overlays.peligro_titulo'),
            mensaje: this.t('overlays.peligro_mensaje'),
            textoConfirmar: this.t('overlays.peligro_boton'),
            peligrosa: true,
            pedirMotivo: true,
          }
        : {
            titulo: this.t('overlays.confirmar_titulo'),
            mensaje: this.t('overlays.confirmar_mensaje'),
          },
    );
    if (!resultado) this.toasts.info(this.t('overlays.cancelado'));
    else
      this.toasts.exito(
        this.t('overlays.confirmado'),
        resultado.motivo
          ? this.t('overlays.confirmado_motivo', { motivo: resultado.motivo })
          : undefined,
      );
  }

  protected mostrarToast(tipo: 'exito' | 'error' | 'aviso' | 'info'): void {
    this.toasts[tipo](this.t(`overlays.toast_titulo_${tipo}`), this.t('overlays.toast_mensaje'));
  }

  protected alElegirMenu(id: string): void {
    const item = this.itemsMenu().find((i) => i.id === id);
    this.toasts.info(this.t('overlays.menu_elegido', { opcion: item?.etiqueta ?? id }));
  }

  protected abrirOrden(orden: OrdenDemo): void {
    this.toasts.info(this.t('tabla.abierta', { numero: orden.numero }));
  }

  private t(clave: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`devUi.${clave}`, params);
  }
}
