import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA, TrackerSchema } from '../types/schema';

/**
 * Esquema configurable de los trackers. Mismo patron que useProfile():
 * un hook sobre useLocalStorage, sin contexto de React — useLocalStorage ya
 * sincroniza entre instancias del mismo tab (evento 'acgen-local-storage')
 * ademas de entre tabs (evento 'storage' nativo).
 *
 * El fallback es POR SECCION a proposito: la seccion `sprint` la anadio la
 * Fase 5; el fallback por seccion es lo que dejo que los esquemas escritos
 * por la Fase 4 (sin `sprint`) siguieran funcionando.
 *
 * Y dentro de la seccion, el fallback es POR LISTA: un `regression` guardado
 * a mano (o restaurado a medias) puede traer `ticketFields` pero no
 * `platforms`, o traer alguna de las dos con un valor que no es un array. Si
 * el fallback fuera solo por seccion, ese objeto incompleto pasaria intacto
 * y `useRegressions` reventaria en `.map` antes de que los guards de
 * `visibleEntries()` pudieran ayudar.
 */
export function useSchema(): [TrackerSchema, (value: TrackerSchema) => void] {
  const [stored, setStored] = useLocalStorage<TrackerSchema>(STORAGE_KEYS.SCHEMA, DEFAULT_SCHEMA);
  const regression = stored?.regression;
  const sprint = stored?.sprint;
  const schema = useMemo<TrackerSchema>(() => ({
    version: 1,
    regression: {
      ticketFields: Array.isArray(regression?.ticketFields)
        ? regression.ticketFields
        : DEFAULT_SCHEMA.regression.ticketFields,
      platforms: Array.isArray(regression?.platforms)
        ? regression.platforms
        : DEFAULT_SCHEMA.regression.platforms,
    },
    sprint: {
      // Misma politica una capa mas abajo: una pestana puede llegar SIN
      // `columns` (o con algo que no es un array) desde un esquema escrito a
      // mano o un backup restaurado a medias. Normalizarla aqui es lo que
      // evita que `tab.columns.filter` reviente en SprintSchemaEditor y se
      // lleve por delante la vista entera del Sprint Tracker — incluido el
      // boton "Restaurar por defecto", que vive dentro del componente caido.
      tabs: Array.isArray(sprint?.tabs)
        ? sprint.tabs.map((t) => (Array.isArray(t?.columns) ? t : { ...t, columns: [] }))
        : DEFAULT_SCHEMA.sprint.tabs,
    },
  }), [regression, sprint]);
  // `schema` (arriba) solo conoce las secciones de ESTA fase. Un llamante que
  // escriba `{ ...schema, regression: ... }` pasaria por aqui un objeto SIN la
  // seccion `sprint` que anadira la Fase 5 (u otra seccion futura), y un
  // setStored directo la borraria en cada escritura, no solo en el reset.
  // Mergear contra `prev` (lo realmente guardado, con todas sus secciones) es
  // lo que hace que preservarlas no dependa de que cada llamante se acuerde.
  const setSchema = useCallback(
    (value: TrackerSchema) => setStored((prev) => ({ ...prev, ...value })),
    [setStored],
  );
  return [schema, setSchema];
}
