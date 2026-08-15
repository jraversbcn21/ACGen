/** Una entrada configurable del esquema: un campo, una plataforma, una columna. */
export interface SchemaEntry {
  /** Clave de almacenamiento. NUNCA cambia una vez creada: los datos guardados
   *  cuelgan de ella. Las entradas por defecto usan los ids historicos; las que
   *  crea el usuario, crypto.randomUUID(). */
  id: string;
  /** Clave i18n de la etiqueta por defecto. */
  labelKey?: string;
  /** Etiqueta literal. La escribe el usuario al renombrar (y entonces gana sobre
   *  labelKey, fijando el texto igual en los dos idiomas), o viene por defecto
   *  cuando ES y EN dicen lo mismo (APPS, WEB). */
  label?: string;
  /** Oculta la entrada del render. NUNCA borra sus datos. */
  hidden?: boolean;
}

/** Una pestana del Sprint Tracker: una entrada configurable que ademas lleva
 *  su propia lista de columnas. El grid es posicional, asi que el indice de
 *  `columns` es la columna de datos y por eso no se puede reordenar ni borrar. */
export interface SprintTabSchema extends SchemaEntry {
  columns: SchemaEntry[];
}

export interface TrackerSchema {
  version: 1;
  regression: {
    ticketFields: SchemaEntry[];
    platforms: SchemaEntry[];
  };
  sprint: {
    tabs: SprintTabSchema[];
  };
}

/** Codificacion exacta de la configuracion cableada de hoy. Sin esquema
 *  guardado, la app se comporta identica y los datos no se reescriben. */
export const DEFAULT_SCHEMA: TrackerSchema = {
  version: 1,
  regression: {
    ticketFields: [
      { id: 'ticket', labelKey: 'regression.colTicket' },
      { id: 'fecha', labelKey: 'regression.colFecha' },
      { id: 'prioridad', labelKey: 'regression.colPrioridad' },
      { id: 'creador', labelKey: 'regression.colCreador' },
      { id: 'squad', labelKey: 'regression.colSquad' },
      { id: 'status', labelKey: 'regression.colStatus' },
    ],
    // APPS y WEB se escriben igual en ES y EN: darles clave i18n crearia dos
    // pares de traduccion byte a byte identicos sin ganancia.
    platforms: [
      { id: 'ios', label: 'APPS' },
      { id: 'webDesktop', label: 'WEB' },
    ],
  },
  sprint: {
    tabs: [
      {
        id: 'resolved', labelKey: 'sprint.tabResolved',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'prioridad', labelKey: 'sprint.colPrioridad' },
          { id: 'autor', labelKey: 'sprint.colAutor' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'created', labelKey: 'sprint.tabCreated',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'prioridad', labelKey: 'sprint.colPrioridad' },
          { id: 'autor', labelKey: 'sprint.colAutor' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'reopened', label: 'ReOpen',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'motivo', labelKey: 'sprint.colMotivo' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'highPriority', labelKey: 'sprint.tabHighPriority',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'motivo', labelKey: 'sprint.colMotivo' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'jsd', label: 'JSD',
        columns: [
          { id: 'jsd', label: 'JSD' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'motivo', labelKey: 'sprint.colMotivo' },
        ],
      },
    ],
  },
};

export function resolveLabel(entry: SchemaEntry | undefined, t: (key: string) => string): string {
  if (!entry) return '';
  if (entry.label !== undefined) return entry.label;
  return entry.labelKey ? t(entry.labelKey) : '';
}

/** Ids de las entradas visibles, en orden. Tolera una lista ausente (esquema
 *  escrito a mano en localStorage, p.ej. `regression: { ticketFields: [] }`
 *  sin `platforms`, o con la clave directamente omitida): sin este fallback
 *  `.filter` lanzaria sobre `undefined` y rompería el render entero. */
export function visibleEntries<T extends SchemaEntry>(entries?: T[]): T[] {
  return (entries ?? []).filter((e) => !e.hidden);
}
