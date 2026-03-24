# OpenClaw AI Tinkerers

Here I'm going to wirte down all my thoughts and ideas about the project we're going to develop

We choose a easy, simple but pragmatic solution fix a current problem

the thing with OpenClaw, no somos concientes de la magnitud de openclaw, si te vas a redes sociales como X y reddit, ves demasiada gente opinando, lo malo que es el software y lo bueno que puede llegar a ser, como todo tomar la informacion con un grano de sal.

Pero vamos a ponernos a pensar un poco, hay informacion ya, y aun hay un contrapeso de gente que no lo quiere ver. Somos bien tercos como nuestros politicos actuales.

Openclaw es el repo mas con mas estrellas de la historia y esto apenas comienza. En meses consiguio lo a linux le tomo en años, y personas aun mencionan que la comparacion no tiene para nada sentido por lo que fue linux en su momento.

Pero igual vamonos a los datos otra vez, creo que estos no mienten
No creo que sea una cancion popular que dura solo unas semanas en el top-ten chart

Y pensemos un poco.
Hasta el año pasado cuales eran las empresas mas ricas del mundo?
si mi conocimiento no me falla todas o la mayoria estaban relacionadas a software

Si dibujamos un diagrama con esta informacion que se ocupa

Hardware -> Software -> Profit

Para tener una solucion digital se necesitan por lo menos 2 cosas a grande escala.
Hardware y software que solucione tu problematica, las empresas que mas dinero hacen estan en software o por lo menos le invierten a este. La inversion es abismal por que el conocimiento obviamente vale.

Software(SAAS) era ayer lo de hoy es Automation

El impacto de openclaw lo estamos viendo por justo esta tendencia o crecimiento exponencial que esta teniendo, y la facilidad de crear tu bot por alguien con minimo conocimiento tech

El cambio de mindset
Mucha gente menciona el cambio de mindset que esto conlleva, yo lo veo incluso mas al fondo es mas un cambio de percepcion no al nivel de una singularidad pero si algo que cambia totalmente de juego.

Antes de openclaw algunos diran que no fue openclaw que fue antes. pero el cambio se nota porque las soluciones que se planteaban todo tenia que ver con crear un sistema/plataforma web o app para algun dispocitivo final que sovlentaran alguna solucion, ahora ya no se ocupa tal complejidad, es solo aprovechar los canales de comunicacion que ya se tienen e integrar con distintos servicios. 

Se democatrizo el software?

Algo similar hicimos nosotros con nuestra idea, antes de pensar en algo revolucionario y complejo, intentamos ser pragmaticos y apuntarle a un problema actual, con el que el ciudadano se topa dia con dia.

Burocracia -> sector medico (IMSS) -> Filas de espera

Y no estamos diciendo que pensar en grande sea malo, al contrario esto es bueno, pero no podemos pensar en construirle un segundo piso a nuestra casa cuando nuestro primer piso opera de forma ineficiente.

Flujo actual de citas
0. Sacar cita
1. Ir a con tu medico general
2. Medico de ta una orden medica, estudio de sangre, Rayos X, Ultrasonido etc.
3. Vas a oficina especifica, laboratorio, rayos x
4. Te preguntan cuando es tu siguiente cita con tu medico o pa cuando la quieres, algunas veces te regresan a con tu medico a programar cita primero, esto implica que tengas que formarte otra vez
5. Te dan tu cita
6. Se te olvida xD

Flujo propuesto
1.Vas a tu medico
2. Medico manda correo a la seccion necesaria
2.1 OpenClaw enlaza con calendario disponible o reglas de negocio necesarias
    - ej. Laboratorio solo puede revisar 20 personas por hora
    - ej. Rayos X solo puede revisar 20 personas por hora - Disponibles 5 el martes, disponibles 10 el jueves, Sabado esta completo
2.2 El medico discute esto con el paciente par ver cual fecha se ajusta mas
2.3 agendan la cita con los datos del paciente
3. Solicitud llega al paciente por su canal de comunicacion establecico, whatsapp y/o correo, se activa un canal de notificaciones al paciente donde te menciona que tu cita ha sido generada, y te estara recordando progresivamente tu cita, una semana antes, un dia antes y una hora antes...


Accesibilidad -> una de las apps que si o si tiene todo mexicano/latinoamericano instalado es whatsapp, el tener que crear o instalar otra app ya es un paso atras.
