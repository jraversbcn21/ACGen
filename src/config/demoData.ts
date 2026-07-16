export interface DemoEntry {
  input: string;
  output: string;
}

export const DEMO_DATA: Record<string, DemoEntry> = {
  acceptance: {
    input: 'Como usuario registrado, quiero filtrar productos por talla para encontrar solo lo que me queda.',
    output: `{panel:title=Criterios aceptacion}
{quote}*Dado* que soy un usuario registrado en la tienda online
*Cuando* accedo al catalogo de productos y aplico el filtro de talla "M"
*Entonces* solo se muestran productos con disponibilidad en talla M
*ResultadoQA:* (/)/(x)
*Pais/Entorno:* Espana/Pro
*Fecha:* 15/07/2026
*Evidencia:*
*Validado por:* Jorge-QA
{quote}{panel}

{panel:title=Criterios aceptacion}
{quote}*Dado* que soy un usuario registrado en la tienda online
*Cuando* selecciono una talla que no tiene stock disponible
*Entonces* el sistema me informa que no hay disponibilidad y me sugiere recibir una alerta cuando vuelva
*ResultadoQA:* (/)/(x)
*Pais/Entorno:* Espana/Pro
*Fecha:* 15/07/2026
*Evidencia:*
*Validado por:* Jorge-QA
{quote}{panel}`,
  },
  testcase: {
    input: 'Validacion del formulario de registro con email invalido.',
    output: JSON.stringify([
      {
        key: 'TC-001',
        summary: 'Registro con email sin @',
        priority: 'Alta',
        type: 'Negativo',
        preconditions: 'Usuario en pagina de registro',
        testSteps: ['1. Ingresar un email sin el simbolo @ (ej: usuario.com)', '2. Completar el resto de campos correctamente', '3. Hacer clic en "Crear cuenta"'],
        expectedResult: 'El formulario muestra un mensaje de error indicando que el formato de email no es valido. No se crea la cuenta.',
      },
      {
        key: 'TC-002',
        summary: 'Registro con email sin dominio',
        priority: 'Media',
        type: 'Negativo',
        preconditions: 'Usuario en pagina de registro',
        testSteps: ['1. Ingresar un email sin dominio (ej: usuario@)', '2. Completar el resto de campos correctamente', '3. Hacer clic en "Crear cuenta"'],
        expectedResult: 'El formulario muestra un mensaje de error. No se crea la cuenta.',
      },
      {
        key: 'TC-003',
        summary: 'Registro con email valido',
        priority: 'Alta',
        type: 'Positivo',
        preconditions: 'Usuario en pagina de registro',
        testSteps: ['1. Ingresar un email valido (ej: maria@qa)', '2. Ingresar contrasena Test1234', '3. Completar el resto de campos correctamente', '4. Hacer clic en "Crear cuenta"'],
        expectedResult: 'La cuenta se crea correctamente. El usuario es redirigido a la pagina de confirmacion.',
      },
    ]),
  },
  bugreport: {
    input: 'El boton de pago no responde en iOS Safari 17. Al intentar finalizar la compra en el checkout, el boton "Pagar ahora" no ejecuta ninguna accion.',
    output: `{panel:title=DESCRIPCION:}
- Entorno/Pais: ES
- Version: iOS 17 / Safari
{panel}
{panel:title=PRECONDICION:}
- Usuario logueado con productos en el carrito
- Checkout completado con direccion de envio y metodo de pago
- Dispositivo iPhone con iOS 17 y Safari
{panel}
{panel:title=PASOS DE REPRODUCCION:}
# Acceder a la web desde Safari en un iPhone con iOS 17
# Iniciar sesion con una cuenta de prueba
# Anadir un producto al carrito
# Ir al checkout y completar los datos de envio
# Seleccionar metodo de pago con tarjeta
# Hacer clic en el boton "Pagar ahora"
{panel}
{panel:title=RESULTADO ACTUAL}
El boton "Pagar ahora" no responde. No se ejecuta ninguna accion ni se muestra ningun mensaje de error o carga. La pagina permanece en el mismo estado.
{panel}
{panel:title=RESULTADO ESPERADO}
Al hacer clic en "Pagar ahora", deberia iniciarse el procesamiento del pago mostrando un indicador de carga y redirigiendo al usuario a la confirmacion de pedido.
{panel}
{panel:title=Criterios aceptacion}
{quote}
Dado que estoy en el ultimo paso del checkout con todos los datos completados en Safari iOS 17
Cuando hago clic en el boton "Pagar ahora"
Entonces el pago se procesa correctamente y veo la pantalla de confirmacion de pedido
ResultadoQA: (/)/(x)
Pais/Entorno: ES/Pro
Fecha: 15-07-2026
Evidencia: Adjuntar captura de pantalla
Validado por: Jorge-QA
{quote}
{panel}`,
  },
  testdata: {
    input: '',
    output: JSON.stringify([
      { nombre: 'Maria', apellidos: 'Garcia Lopez', direccion: 'Calle Mayor 12', codigoPostal: '28013', ciudad: 'Madrid', provincia: 'Madrid', pais: 'ES', telefono: '+34 612 345 678' },
      { nombre: 'Jean', apellidos: 'Dupont', direccion: '15 Rue de la Paix', codigoPostal: '75002', ciudad: 'Paris', provincia: 'Ile-de-France', pais: 'FR', telefono: '+33 6 12 34 56 78' },
      { nombre: 'Luca', apellidos: 'Rossi', direccion: 'Via Roma 45', codigoPostal: '20121', ciudad: 'Milano', provincia: 'Lombardia', pais: 'IT', telefono: '+39 345 678 9012' },
    ]),
  },
};
