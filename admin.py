import os
import firebase_admin
from firebase_admin import firestore_async, credentials, firestore
import openpyxl
from flask import Flask, json, render_template, request, redirect, session, url_for
import pandas as pd
from datetime import datetime
from babel.dates import format_datetime

#Firebase - Produccion
firebase_creds = os.environ.get("FIREBASE_CREDENCIALES")
cred_dict = json.loads(firebase_creds)
cred = credentials.Certificate(cred_dict)

#Firebase - Desarrollo
#cred = credentials.Certificate("credenciales.json")


firebase_admin.initialize_app(cred)
db = firestore.client()

# Flask
app = Flask(__name__, static_folder='assets', static_url_path='/assets')
app.secret_key = 'clave_secreta_segura' 

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        usuario = request.form['usuario']
        contraseña = request.form['contraseña']

        # Buscar usuario en Firestore
        usuarios = db.collection('Administrador').where('nombre', '==', usuario).where('password', '==', contraseña).get()
        if usuarios:
            session['usuario'] = usuario
            return redirect('/admin')
        else:
            return render_template("login.html", error="Credenciales incorrectas")

    return render_template("login.html")

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if 'usuario' not in session:
        return redirect('/login')
    
    jornada_actual = obtener_jornada_actual()

    if request.method == 'POST':
        # ACTUALIZAR JORNADA
        if 'actualizar_jornada' in request.form:
            nueva_jornada = int(request.form.get('jornada'))
            try:
                db.collection('Jornada').document('jornada').set({
                    'numero': nueva_jornada
                }, merge=True)

                jornada_actual = obtener_jornada_actual()
                return render_template(
                    'admin.html',
                    mensjornada='Jornada actualizada correctamente ✅',
                    jornada_actual=jornada_actual
                )
            except Exception as e:
                return render_template(
                    'admin.html',
                    errorjor=f'Error al actualizar jornada: {e}'
                )
        # ELIMINAR JORNADA        
        elif 'eliminar_jornada' in request.form:
            try:
                jornada_actual = obtener_jornada_actual()

                partidos_ref = db.collection("Partidos") \
                    .where("jornada", "==", jornada_actual) \
                    .stream()

                contador = 0

                for partido in partidos_ref:
                    partido.reference.delete()
                    contador += 1

                return render_template(
                    "admin.html",
                    mensaje=f"{contador} partidos eliminados correctamente 🗑️",
                    jornada_actual=jornada_actual
                )

            except Exception as e:
                return render_template(
                    "admin.html",
                    error=f"Error al eliminar partidos: {e}",
                    jornada_actual=jornada_actual
                )
        # Verificar si se subió un archivo
        elif 'archivo' in request.files:
            archivo = request.files['archivo']
            if archivo.filename.endswith('.xlsx'):
                try:
                    gen_tabla(archivo)
                    archivo.seek(0)  # Reiniciar el cursor del archivo
                    gen_goleador(archivo)
                    return render_template('admin.html', mensaje='Datos subidos correctamente ✅')
                except Exception as e:
                    return render_template('admin.html', error=f'Error al procesar el archivo: {e}')
            else:
                return render_template('admin.html', error='Formato inválido para archivo de tabla.')

        elif 'horarios' in request.files:
            archivo = request.files['horarios']
            if archivo.filename.endswith('.xlsx'):
                try:
                    procesar_jornadas(archivo)
                    return render_template('admin.html', mensaje="Horarios cargados correctamente.")
                except Exception as e:
                    return render_template('admin.html', error=f"Error al procesar horarios: {e}")
            else:
                return render_template('admin.html', error="Formato inválido para archivo de horarios.")

    # GET normal
    jornada_actual = obtener_jornada_actual()
    return render_template('admin.html', jornada_actual=jornada_actual)

def gen_tabla(archivo):
    try:
        df = pd.read_excel(archivo, sheet_name='Tabla')
        # Suponiendo que Excel tiene columnas como:
        # Equipo | J | G | E | P | GF | GC | D | Pts
        for _, fila in df.iterrows():
            data = {
                'equipo': fila['Equipo'],
                'j': int(fila['PJ']),
                'g': int(fila['G']),
                'e': int(fila['E']),
                'p': int(fila['P']),
                'gf': int(fila['GF']),
                'gc': int(fila['GC']),
                'd': int(fila['DG']),
                'pts': int(fila['Pts'])
            }
            # Puedes usar el nombre del equipo como ID para sobrescribir
            db.collection('Equipos').document(data['equipo']).set(data)
        return render_template('admin.html', mensaje='Datos subidos correctamente ✅')
    except Exception as e:
        return render_template('admin.html', error=f'Error al procesar el archivo: {e}')
    

def gen_goleador(archivo):
    try:
        df_goles = pd.read_excel(archivo, sheet_name='Goleador')
                
        # Suponiendo que tu Excel tiene columnas como:
        # Goleadores | Equipo | Goles

        for _, fila in df_goles.iterrows():
            data = {
                'nombre': fila['Goleadores'],
                'equipo': fila['Equipo'],
                'goles': int(fila['Goles']),
                }
                # Puedes usar el nombre del equipo como ID para sobrescribir
            db.collection('Goleadores').document(data['nombre']).set(data)
        return render_template('admin.html', mensaje='Datos subidos correctamente ✅')
    except Exception as e:
        return render_template('admin.html', error=f'Error al procesar el archivo: {e}')

def formatear_fecha_hora(fecha, hora):
    # Si ya vienen como objetos datetime/pandas
    if isinstance(fecha, pd.Timestamp):
        fecha = fecha.to_pydatetime()
    if isinstance(hora, pd.Timestamp):
        hora = hora.to_pydatetime().time()
    print("Hora:   ",type(hora))

    # Combinar fecha + hora
    fecha_hora = datetime.combine(fecha.date(), hora)

    # Formatear la fecha y hora
    return format_datetime(fecha_hora, "d 'de' MMMM ' ' y 'a las' h:mm a", locale='es_MX')

def procesar_jornadas(horarios):
    df = pd.read_excel(horarios, sheet_name='horario')

    for index, row in df.iterrows():
        try:
            fecha = row["Fecha"]  # Ya es tipo datetime
            hora = row["Hora"]    # Ya es tipo datetime.time o Timestamp

            equipo1 = str(row["Equipo1"]).strip()
            equipo2 = str(row["Equipo2"]).strip()
            jornada_num = int(row["Jornada"])

            fecha_hora = formatear_fecha_hora(fecha, hora)

            data = {
                "fecha_hora": fecha_hora,
                "equipo1": equipo1,
                "equipo2": equipo2,
                "jornada": jornada_num,
            }

            print(data)

            # Guardar en Firestore
            doc_ref = db.collection("Partidos").document(f"{jornada_num}_{equipo1}_{equipo2}")
            doc_ref.set(data)

        except Exception as e:
            print(f"Error procesando fila {index + 2}: {e}")
            
def obtener_jornada_actual():
    doc = db.collection('Jornada').document('jornada').get()
    if doc.exists:
        return doc.to_dict().get('numero', 1)
    return 1


@app.route('/logout')
def logout():
    session.pop('autenticado', None)
    return redirect('/')

@app.route('/goleador')
def goleador():
    return render_template('goleador.html')

@app.route('/reglas')
def reglas():
    return render_template('reglas.html')

@app.route('/partidos')
def partidos():
    return render_template('partidos.html')

if __name__ == '__main__':
    #app.run(debug=True)  # Solo para desarrollo, no usar en producción
    app.run(host='0.0.0.0', port=5000)