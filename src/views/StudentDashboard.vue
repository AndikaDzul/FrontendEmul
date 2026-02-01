<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Html5Qrcode } from 'html5-qrcode'
import axios from 'axios'

const router = useRouter()
const backendUrl = 'https://backend-test-n4bo.vercel.app'

// State
const student = ref({
  name: '',
  nis: '',
  class: ''
})
const history = ref([])
const totalHadir = ref(0)
const loading = ref(false)

// QR State
const qrVisible = ref(false)
let html5QrCode = null
let scanning = false

// Toast
const toast = ref({ show:false, msg:'', type:'success' })
const showToast = (msg,type='success')=>{
  toast.value={show:true,msg,type}
  setTimeout(()=>toast.value.show=false,3000)
}

// ==== LOAD DATA ====
const loadHistory = async () => {
  if (!student.value.nis) return
  loading.value = true
  try {
    const res = await axios.get(`${backendUrl}/attendance/history/${student.value.nis}`)
    history.value = res.data
    totalHadir.value = res.data.filter(h => h.status === 'Hadir').length
  } catch (err) {
    console.error('Gagal load history', err)
    history.value = []
  } finally {
    loading.value = false
  }
}

// ==== FORMAT TIME ====
const formatTime = (dateStr) => {
  if(!dateStr) return '-'
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ==== QR SCAN ====
const startScan = async () => {
  qrVisible.value = true
  scanning = false

  // Tunggu DOM render
  setTimeout(async () => {
    html5QrCode = new Html5Qrcode('qr-reader')
    try {
      const cams = await Html5Qrcode.getCameras()
      if (!cams.length) {
        showToast('❌ Kamera tidak tersedia', 'error')
        qrVisible.value = false
        return
      }

      // Gunakan kamera belakang jika ada (biasanya index terakhir)
      const cameraId = cams.length > 1 ? cams[cams.length - 1].id : cams[0].id

      await html5QrCode.start(
        cameraId,
        { fps: 10, qrbox: 250 },
        async (decoded) => {
          if (scanning) return
          
          // Siswa scan QR apapun untuk absen
          // Yang dikirim adalah NIS siswa yang login
          
          scanning = true
          try {
            // Kirim NIS siswa yang sedang login ke backend
            await axios.post(`${backendUrl}/attendance/scan`, {
              nis: student.value.nis
            })
            showToast('✅ Absensi Berhasil!')
            await loadHistory()
            
            // Auto close setelah sukses
            setTimeout(() => stopScan(), 1000)
          } catch (err) {
            const msg = err.response?.data?.message || 'Gagal absen'
            showToast(`❌ ${msg}`, 'error')
            scanning = false
          }
        },
        (errorMessage) => {
          // ignore parsing error
        }
      )
    } catch (err) {
      console.error('Camera error:', err)
      
      // Pesan error yang lebih jelas
      if (err.name === 'NotAllowedError') {
        showToast('❌ Izin kamera ditolak. Klik Allow/Izinkan', 'error')
      } else if (err.name === 'NotFoundError') {
        showToast('❌ Kamera tidak ditemukan', 'error')
      } else if (err.name === 'NotReadableError') {
        showToast('❌ Kamera sedang digunakan aplikasi lain', 'error')
      } else {
        showToast('❌ Gagal membuka kamera. Gunakan HTTPS atau localhost', 'error')
      }
      
      qrVisible.value = false
    }
  }, 100)
}

const stopScan = async () => {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
      await html5QrCode.clear()
    } catch (e) { /* ignore */ }
    html5QrCode = null
  }
  qrVisible.value = false
}

// ==== MOUNT ====
onMounted(async () => {
  // Ambil data dari localStorage
  const nis = localStorage.getItem('studentNis')
  const name = localStorage.getItem('studentName')
  const kelas = localStorage.getItem('studentClass')
  const role = localStorage.getItem('role')

  // Debug: Log data untuk troubleshooting
  console.log('Student Data from localStorage:', { nis, name, kelas, role })

  // Cek validasi
  if (!nis || role !== 'siswa') {
    console.error('Missing NIS or wrong role. Redirecting to login.')
    router.replace('/login')
    return
  }

  // Set state - pastikan semua field ada
  student.value = {
    name: name || 'Siswa',
    nis: nis || 'N/A', // Fallback jika undefined
    class: kelas || '-'
  }

  console.log('Student state set:', student.value)

  await loadHistory()
})

onUnmounted(() => {
  stopScan()
})

// ==== LOGOUT ====
const logout = () => {
  localStorage.clear()
  router.replace('/login')
}
</script>


<template>
<div class="dashboard-siswa">
  <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.msg }}</div>
  <header class="header">
    <div class="info">
      <div class="avatar">{{ student.name ? student.name.charAt(0).toUpperCase() : 'S' }}</div>
      <div><h3>{{ student.name }}</h3><small>{{ student.class }} • NIS {{ student.nis }}</small></div>
    </div>
    <button @click="logout" class="logout-btn">🚪 Logout</button>
  </header>

  <section class="stats">
    <div class="card"><h2>{{ totalHadir }}</h2><p>Total Hadir</p></div>
    <button class="scan-btn" @click="startScan">📷 Scan QR Absensi</button>
  </section>

  <div v-if="qrVisible" id="qr-reader" class="qr-reader"></div>

  <section class="history">
    <h3>🕒 Riwayat Absensi</h3>
    <p v-if="loading">Memuat...</p>
    <ul v-else>
      <li v-for="(h,i) in history" :key="i">
        <span>{{ formatTime(h.createdAt) }}</span>
        <b :class="h.status.toLowerCase()">{{ h.status }}</b>
      </li>
    </ul>
  </section>
</div>
</template>


<style scoped>
.dashboard-siswa { padding:20px; font-family:'Inter',sans-serif; min-height:100vh; background:#f0f2f5; }

.header { display:flex; justify-content:space-between; align-items:center; background:white; padding:14px 20px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.06); margin-bottom:20px; }
.info { display:flex; align-items:center; gap:14px; }
.avatar { width:50px; height:50px; border-radius:50%; background:#4f46e5; color:white; display:flex; justify-content:center; align-items:center; font-weight:700; font-size:1.2rem; }
.logout-btn { background:#ef4444; color:white; border:none; padding:8px 16px; border-radius:12px; cursor:pointer; }

.stats { display:flex; gap:16px; margin-bottom:20px; align-items:center; flex-wrap:wrap; }
.card { flex:1; background:#4f46e5; color:white; padding:20px; border-radius:16px; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
.card h2 { font-size:2rem; font-weight:700; }
.card p { margin-top:4px; font-weight:500; }
.scan-btn { background:#10b981; color:white; border:none; padding:14px; border-radius:16px; font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
.scan-btn:hover { transform:scale(1.05); }

.qr-reader { margin:16px auto; max-width:320px; border-radius:16px; overflow:hidden; }

.history { background:white; padding:16px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05); margin-top:20px; }
.history h3 { font-weight:600; margin-bottom:12px; }
.history li { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e5e7eb; }
.hadir { color:#10b981 }
.izin { color:#f59e0b }
.sakit { color:#3b82f6 }
.alfa { color:#ef4444 }

.toast { position:fixed; top:20px; right:20px; padding:12px 20px; border-radius:12px; color:white; font-weight:600; z-index:999; }
.toast.success { background:#10b981 }
.toast.error { background:#ef4444 }
</style>
