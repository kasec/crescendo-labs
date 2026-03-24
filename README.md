# CRESCENDO LABS - AI Tinkerers

## Table of Contents

- [Topic](#topic)
- [Architecture](#architecture)
  - [OpenClaw Domain](#openclaw-domain)
- [TO-DO](#to-do)
  - [1. Un "One-Pager" Slide](#1-un-one-pager-slide-enlace-a-google-slides-canva-etc)
  - [2. Video Demo de 1 Minuto](#2-video-demo-de-1-minuto-enlace-de-loom-o-youtube-oculto)
  - [3. Repositorio de Código Público](#3-repositorio-de-código-público-enlace-de-github--gitlab)

## Topic

Tech Health - Burocrasy - Goverment

### Description

Antes de intentar solucionar problemas complejos nosotros en su lugar intentamos resolver problemas actuales y ser mas pragmaticos

Un problema local por el que el mexicano tiene que lidiar en algun momento es con una cita medica en el IMSS

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


## Architecture

This project contains:

- demo-video that will be eventually created with remotion, ensure we have a skill to do that
- slide that will be created using slidev, make sure we have skill installed
- openclaw project, here we will have the code related to openclaw

### OpenClaw Domain

- We will need a database with some tables
    - Patients
    - Drs.
    - Labs
    - Appointments
- A gmail communication channel
    - Dr is going to see laboratory calendar and verify available spaces
    - Patient is going to pick what appointmen he wants
    - An appointment confirmation approved by doctor a and received by patient as well.
    Use cases - Can more than one dr use the app
        Dr. He can schedule patient sessions, he can get access to available spaces
        Dr. receive notification when he sucessfully book a lab appointment
    Edge cases - Can more than one lab use the app
        Laboratory can get access to list of patients
        Laboratory receive notification when a new patient is schedule
    Edge cases - Can more than one patient use the app
        He can only received information regarding the next appointment
    Edge cases - Any other account is not allowed
        Even we can create a mechanism similar to fail2ban to ban users who tries to communicate with channel

- In future versions sms or whatsapp channel with notifications periodically


## TO-DO

### 1. Un “One-Pager” Slide (Enlace a Google Slides, Canva, etc.)

Un solo slide que funcione como su resumen ejecutivo técnico. Debe contener:

Datos básicos: Nombre del proyecto, integrantes del equipo y la vertical elegida (HealthTech, AgroTech o FinTech).

Problema y Solución: Máximo 2 oraciones. ¿Qué hace exactamente su agente?

Arquitectura OpenClaw: Un diagrama simple o viñetas explicando cómo manejaron el estado, el llamado de herramientas (tools) y los ciclos de razonamiento usando el framework.

Métricas Clave: Una breve mención de cómo optimizaron la eficiencia de tokens y qué barreras de seguridad (guardrails) implementaron.

### 2. Video Demo de 1 Minuto (Enlace de Loom o YouTube Oculto)

Queremos ver al agente en acción, sin rodeos comerciales.
La Regla: Máximo 1 minuto. Cero intros largas. Comiencen a grabar, compartan pantalla, denle play y muéstrennos al agente de OpenClaw ejecutando su tarea con éxito.

### 3. Repositorio de Código Público (Enlace de GitHub / GitLab)

Por cuestiones de tiempo, los jueces no clonarán ni ejecutarán los proyectos localmente, pero sí leerán su ReadME para evaluar la implementación técnica.

La Regla: El repositorio debe ser público.

El README.md: No suban el código sin explicación. Su repositorio debe tener un README.md bien estructurado que le indique a los jueces exactamente en qué carpeta/archivo vive la lógica principal de OpenClaw, qué APIs de terceros utilizaron y cómo fluye su arquitectura.