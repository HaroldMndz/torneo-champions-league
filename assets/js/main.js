import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, where, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5BeCYK1HRszTi6mQm2QX_zXdcqgd-2lk",
  authDomain: "futbol-7shx.firebaseapp.com",
  projectId: "futbol-7shx",
  storageBucket: "futbol-7shx.firebasestorage.app",
  messagingSenderId: "669152950803",
  appId: "1:669152950803:web:3bb035878dc1e03a325de6",
  measurementId: "G-7BVTPJB03V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

const meses = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

async function getEquipos() {
  mostrarLoader(); // Mostrar loader mientras se cargan los equipos
  const tabla = document.getElementById("tabla-equipos");
  tabla.innerHTML = ""; // Limpiar contenido

  try {
    const equiposRef = collection(db, "Equipos");
    const q = query(equiposRef, orderBy("pts", "desc"), orderBy("d", "desc"));
    const querySnapshot = await getDocs(q);
    let index = 1;

    if (querySnapshot.empty) {
      document.getElementById("estado").innerText = "No hay equipos registrados.";
      return;
    }
    querySnapshot.forEach((doc) => {
      const datos = doc.data();

      let clasePosicion = "";
      if (index <= 3) clasePosicion = "zona-clasificacion"; // verde
      else if (index >= 9) clasePosicion = "zona-riesgo";   // rojo
      else clasePosicion = "zona-media";

      const fila = document.createElement("tr");
      fila.innerHTML = `
      <td class="posicion ${clasePosicion}">${index++}</td>
      <td><img class="img-tabla" src="/assets/img/${datos.equipo}.png" alt="${datos.equipo || 'Equipo sin logo'}"></td>
      <td>${datos.equipo || "Sin nombre"}</td>
      <td>${datos.j || 0}</td>
      <td>${datos.g || 0}</td>
      <td>${datos.e || 0}</td>
      <td>${datos.p || 0}</td>
      <td>${datos.gf || 0}</td>
      <td>${datos.gc || 0}</td>
      <td>${datos.d ?? (datos.gf - datos.gc)}</td>
      <td class="puntos">${datos.pts || 0}</td>
    `;
      tabla.appendChild(fila);
    });
    console.log("Equipos cargados correctamente");
  } catch (error) {
    console.error("Error al cargar equipos:", error);
    document.getElementById("estado").innerText = "Error al cargar equipos.";
  }
  finally {
    ocultarLoader(); // Ocultar loader después de cargar los equipos
  }
}//End getEquipos

async function getGoleadores() {
  mostrarLoader(); // Mostrar loader mientras se cargan los goleadores
  const tablagoleador = document.getElementById("tabla-goleador");
  tablagoleador.innerHTML = ""; // Limpiar contenido

  const jornadaDocRef = doc(db, "Jornada", "jornada");
  const jornadaSnap = await getDoc(jornadaDocRef);
  const jornada_actual = jornadaSnap.exists() ? jornadaSnap.data().numero : 1;
  if (jornada_actual > 4) {
    try {
      const goleadoresRef = collection(db, "Goleadores");
      const q = query(goleadoresRef,
        where("goles", ">", 0), // Filtrar solo goleadores con goles
        orderBy("goles", "desc"));
      const querySnapshot = await getDocs(q);

      let index = 1;
      if (querySnapshot.empty) {
        document.getElementById("estado").innerText = "No hay goleadores registrados.";
        return;
      }
      querySnapshot.forEach((doc) => {
        const datos = doc.data();

        const fila = document.createElement("tr");
        fila.innerHTML = `
        <td>${index++}</td>
        <td>${datos.nombre || "Sin nombre"}</td>
        <td>${datos.equipo || "Sin equipo"}</td>
        <td class="puntos">${datos.goles || 0}</td>
      `;
        tablagoleador.appendChild(fila);
      });
      console.log("Goleadores cargados correctamente");
    } catch (error) {
      console.error("Error al cargar goleadores:", error);
    } finally {
      ocultarLoader(); // Ocultar loader después de cargar los goleadores
    }
  }
  else {
    document.getElementById("estado").innerText = "Los datos se mostraran hasta la jornada 5.";
  }

}//End getGoleadores

async function getJornada() {
  const jornada = document.getElementById("jornada");
  jornada.innerText = ""; // Limpiar contenido
  const jornadaRef = doc(db, "Jornada", "jornada");

  try {
    const jornadaSnap = await getDoc(jornadaRef);

    if (!jornadaSnap.exists()) {
      jornada.innerText = "No hay jornadas registradas.";
      return;
    }

    const data = jornadaSnap.data();
    jornada.innerText = `Jornada # ${data.numero || "Sin número"}`;

  } catch (error) {
    console.error("Error al obtener la jornada:", error);
    jornada.innerText = "Error al cargar la jornada.";
  }

}//End getJornada




async function getPartidos() {
  mostrarLoader();
  const tablaPartidos = document.getElementById("partidos");
  tablaPartidos.innerHTML = "";

  const jornadaDocRef = doc(db, "Jornada", "jornada");
  const jornadaSnap = await getDoc(jornadaDocRef);
  const jornada_actual = jornadaSnap.exists() ? jornadaSnap.data().numero : 1;

  try {
    const partidosRef = collection(db, "Partidos");

    const q = query(
      partidosRef,
      where("jornada", ">=", jornada_actual),
      orderBy("jornada")
      // 🔥 ¡No uses orderBy("fecha_hora") si es string! Firebase no lo ordena bien
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      tablaPartidos.innerHTML = "<p class='tituloSecundario'>No hay partidos programados.</p>";
      return;
    }

    // 1. Recolecta todos los partidos
    const partidos = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      partidos.push(data);
    });

    // 2. Ordena por jornada y luego por fecha_hora parseada
    partidos.sort((a, b) => {
      return parseFecha(a.fecha_hora) - parseFecha(b.fecha_hora);
    });

    // 3. Renderiza partidos ordenados
    partidos.forEach((partido) => {
      const fila = document.createElement("div");
      fila.className = "col-12";
      fila.innerHTML = `
        <div class="col-12">
          <div class="match-card text-center">
            <div class="match-date">Jornada ${partido.jornada}</div>
            <div class="teams">
              <span><img class="team-logo" src="/assets/img/${partido.equipo1}.png" alt=""></span>
              <span class="team-name">${partido.equipo1}</span>
              <span class="vs">VS</span>
              <span class="team-name">${partido.equipo2}</span>
              <span><img class="team-logo" src="/assets/img/${partido.equipo2}.png" alt=""></span>
            </div>
            <div class="match-date">${partido.fecha_hora}</div>
          </div>
        </div>
      `;
      tablaPartidos.appendChild(fila);
    });

  } catch (error) {
    console.error("Error al cargar partidos:", error);
  } finally {
    ocultarLoader();
  }
}//End getPartidos

function parseFecha(fechaStr) {
  const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };

  fechaStr = limpiarFecha(fechaStr);

  const regex = /(\d{1,2}) de (\w+) (\d{4}) a las (\d{1,2}):(\d{2})\s?(a\.m\.|p\.m\.)/i;
  const match = fechaStr.match(regex);
  if (!match) {
    console.warn("❌ No se pudo parsear:", fechaStr);
    return new Date(0);
  }

  let [_, dia, mesStr, anio, hora, minuto, meridiano] = match;
  const mes = meses[mesStr.toLowerCase()];
  dia = parseInt(dia);
  anio = parseInt(anio);
  hora = parseInt(hora);
  minuto = parseInt(minuto);

  if (meridiano === "p.m." && hora < 12) hora += 12;
  if (meridiano === "a.m." && hora === 12) hora = 0;

  return new Date(anio, mes, dia, hora, minuto);
}//End parseFecha

function limpiarFecha(fechaStr) {
  return fechaStr
    .toLowerCase()
    .replace(/\s+/g, " ")         // reemplaza múltiples espacios por uno
    .replace("pm", "p.m.")
    .replace("am", "a.m.")
    .trim();
}// End limpiarFecha

if (document.getElementById("tabla-equipos")) {
  getEquipos();
  getJornada();
}

if (document.getElementById("tabla-goleador")) {
  getGoleadores();
}
if (document.getElementById("partidos")) {
  getPartidos();
}

function mostrarLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "grid";
}

function ocultarLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  ocultarLoader(); // Oculta el loader cuando la página ya se cargó

});