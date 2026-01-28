<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Html5Qrcode } from 'html5-qrcode'
import axios from 'axios'

const router = useRouter()
const backendUrl = 'https://backend-test-n4bo.vercel.app'

/* ================= USER ================= */
const siswa = ref({
  name: '',
  nis: '',
  kelas: ''
})

/* ================= DATA ================= */
const attendanceHistory = ref([])
const totalHadir = ref(0)
const loading = ref(false)

/* ================= QR ================= */
const qrVisible = ref(false)
let html5QrCode = null
let scanning = false // 🔐 prevent double scan

/* ================= TOAST ================= */
const toast = ref({ show:false, msg:'', type:'success' })
const showToast = (msg, type='success') => {
  toast.value = { show:true, msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

/* ================= AUDIO ================= */
const successSound = new Audio('/sounds/success.mp3') // taruh di public/sounds/

/* ================= FORMAT TIME ================= */
const formatTime = (t) =>
  new Date(t).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })

/* ================= LOAD DATA ================= */
const loadAttendance = async () => {
  loading.value = true
  try {
    const res = await axios.get(`${backendUrl}/attendance/history/${siswa.value.nis}`)
    attendanceHistory.value = res.data || []
    totalHadir.value = attendanceHistory.value.filter(a => a.status === 'Hadir').length
  } catch {
    attendanceHistory.value = []
    totalHadir.value = 0
  } finally {
    loading.value = false
  }
}

/* ================= QR SCAN ================= */
const startScan = async () => {
  qrVisible.value = true
  scanning = false

  html5QrCode = new Html5Qrcode('qr-reader')
  const cams = await Html5Qrcode.getCameras()
  if (!cams.length) {
    showToast('❌ Kamera tidak tersedia', 'error')
    return
  }

  await html5QrCode.start(
    cams[cams.length - 1].id,
    { fps: 12, qrbox: 300 },
    async decoded => {
      if (scanning) return
      scanning = true

      // cek QR sesuai NIS siswa
      if (decoded !== siswa.value.nis) {
        showToast('❌ QR tidak valid', 'error')
        scanning = false
        return
      }

      try {
        await axios.patch(`${backendUrl}/attendance/scan/${decoded}`, { nis: siswa.value.nis })

        // 🔊 PLAY SOUND
        successSound.currentTime = 0
        successSound.play()

        // 📳 GETAR
        if (navigator.vibrate) navigator.vibrate(200)

        showToast('✅ Absensi berhasil')
        await loadAttendance()
      } catch {
        showToast('❌ Absensi gagal', 'error')
      }

      stopScan()
    }
  )
}

const stopScan = async () => {
  if (html5QrCode) {
    await html5QrCode.stop()
    await html5QrCode.clear()
  }
  qrVisible.value = false
}

/* ================= LIFECYCLE ================= */
onMounted(async () => {
  siswa.value.name = localStorage.getItem('studentName')
  siswa.value.nis = localStorage.getItem('studentNis')
  siswa.value.kelas = localStorage.getItem('studentClass')

  if (!siswa.value.nis || localStorage.getItem('role') !== 'siswa') {
    router.push('/login')
    return
  }

  await loadAttendance()
})

onUnmounted(stopScan)

const logout = () => {
  localStorage.clear()
  router.push('/login')
}
</script>

<template>
<div class="siswa">

  <!-- TOAST -->
  <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.msg }}</div>

  <!-- HEADER -->
  <header class="header">
    <div>
      <h3>{{ siswa.name }}</h3>
      <small>{{ siswa.kelas }} • NIS {{ siswa.nis }}</small>
    </div>
    <button @click="logout">Logout</button>
  </header>

  <!-- STATS -->
  <section class="stats">
    <div class="card">
      <h2>{{ totalHadir }}</h2>
      <p>Total Hadir</p>
    </div>
    <button class="scan" @click="startScan">📷 Scan QR Absensi</button>
  </section>

  <div v-if="qrVisible" id="qr-reader" class="qr"></div>

  <!-- HISTORY -->
  <section class="history">
    <h4>Riwayat Absensi</h4>
    <p v-if="loading">Memuat...</p>
    <ul v-else>
      <li v-for="(a,i) in attendanceHistory" :key="i">
        <span>{{ formatTime(a.createdAt) }}</span>
        <b :class="a.status.toLowerCase()">{{ a.status }}</b>
      </li>
    </ul>
  </section>

</div>
</template>

<style scoped>
.siswa {
  min-height:100vh;
  padding:24px;
  background:#f8fafc;
  font-family:Inter,sans-serif;
}

.header {
  background:white;
  padding:16px;
  border-radius:14px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:20px;
  box-shadow:0 4px 12px rgba(0,0,0,0.05);
}

.header h3 { font-weight:700; font-size:1.2rem }
.header small { color:#6b7280 }

.stats {
  display:flex;
  gap:16px;
  margin-bottom:20px;
  flex-wrap:wrap;
  align-items:center;
}

.card {
  flex:1;
  background:#4f46e5;
  color:white;
  padding:20px;
  border-radius:16px;
  text-align:center;
  box-shadow:0 4px 12px rgba(0,0,0,0.1);
}

.card h2 { font-size:2rem; font-weight:700 }
.card p { margin-top:4px; font-weight:500 }

.scan {
  background:#10b981;
  color:white;
  border:none;
  padding:14px;
  border-radius:16px;
  font-weight:600;
  cursor:pointer;
  min-width:180px;
  box-shadow:0 4px 12px rgba(0,0,0,0.1);
  transition:0.2s;
}
.scan:hover { transform:scale(1.05) }

.qr {
  margin:16px auto;
  max-width:300px;
  border-radius:16px;
  overflow:hidden;
}

.history {
  background:white;
  padding:16px;
  border-radius:16px;
  box-shadow:0 4px 12px rgba(0,0,0,0.05);
}

.history h4 { font-weight:600; margin-bottom:12px }

.history li {
  display:flex;
  justify-content:space-between;
  padding:10px 0;
  border-bottom:1px solid #e5e7eb;
}

.hadir { color:#10b981 }
.izin { color:#f59e0b }
.sakit { color:#3b82f6 }
.alfa { color:#ef4444 }

.toast {
  position:fixed;
  top:20px;
  right:20px;
  padding:12px 20px;
  border-radius:12px;
  color:white;
  font-weight:600;
  z-index:999;
}
.toast.success { background:#10b981 }
.toast.error { background:#ef4444 }
</style>
