<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { Html5Qrcode } from 'html5-qrcode'
import axios from 'axios'

const router = useRouter()
const backendUrl = 'https://backend-test-n4bo.vercel.app'

/* ================= USER ================= */
const user = ref({ name:'', role:'', mapel:'' })

/* ================= DATA ================= */
const students = ref([])
const schedule = ref([])
const searchQuery = ref('')
const loadingStudents = ref(false)
const loadingSchedule = ref(false)

/* ================= QR SCAN ================= */
const qrScannerVisible = ref(false)
let html5QrCode = null
const scannedNis = ref(new Set())

/* ================= AUDIO ================= */
const successSound = new Audio('/sounds/success.mp3') // ⬅️ taruh di public/sounds/

/* ================= QR MODAL ================= */
const qrModalVisible = ref(false)
const selectedQr = ref('')

/* ================= TOAST ================= */
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const showToast = (msg, type = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
  setTimeout(() => toastVisible.value = false, 3000)
}

/* ================= COMPUTED ================= */
const avatarInitial = computed(() =>
  user.value.name ? user.value.name.charAt(0).toUpperCase() : 'G'
)

const filteredStudents = computed(() => {
  if (!searchQuery.value) return students.value
  return students.value.filter(s =>
    s.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const hadirCount = computed(() =>
  students.value.filter(s => s.status === 'Hadir').length
)

/* ================= LOAD DATA ================= */
const loadStudents = async () => {
  if (user.value.role !== 'guru') return
  loadingStudents.value = true
  try {
    const res = await axios.get(`${backendUrl}/students`)
    students.value = await Promise.all(
      res.data.map(async s => ({
        ...s,
        status: s.status || '',
        qrCode: await QRCode.toDataURL(s.nis)
      }))
    )
  } finally {
    loadingStudents.value = false
  }
}

const loadSchedule = async () => {
  loadingSchedule.value = true
  try {
    const res = await axios.get(`${backendUrl}/schedule`)
    schedule.value = res.data
  } finally {
    loadingSchedule.value = false
  }
}

/* ================= UPDATE STATUS ================= */
const updateStatus = async (nis, status) => {
  const student = students.value.find(s => s.nis === nis)
  if (!student) return
  student.status = status
  try {
    await axios.patch(`${backendUrl}/students/attendance/${nis}`, { status })
  } catch {}
}

/* ================= QR SCAN ================= */
const startQrScan = async () => {
  qrScannerVisible.value = true
  scannedNis.value.clear()

  setTimeout(async () => {
    html5QrCode = new Html5Qrcode('qr-reader')
    const cams = await Html5Qrcode.getCameras()
    if (!cams.length) return

    await html5QrCode.start(
      cams[cams.length - 1].id,
      { fps: 12, qrbox: 320 },
      decoded => {
        if (scannedNis.value.has(decoded)) return

        const student = students.value.find(s => s.nis === decoded)
        if (!student) {
          showToast('❌ QR tidak valid', 'error')
          return
        }

        scannedNis.value.add(decoded)
        updateStatus(decoded, 'Hadir')

        // 🔊 PLAY SOUND
        successSound.currentTime = 0
        successSound.play()

        // 📳 GETAR
        if (navigator.vibrate) navigator.vibrate(200)

        // 🔔 NOTIF
        showToast(`✅ Absen berhasil: ${student.name}`, 'success')
      }
    )
  }, 300)
}

const stopQrScan = async () => {
  if (html5QrCode) {
    await html5QrCode.stop()
    await html5QrCode.clear()
  }
  qrScannerVisible.value = false
}

/* ================= QR MODAL ================= */
const openQrModal = qr => {
  selectedQr.value = qr
  qrModalVisible.value = true
}
const closeQrModal = () => qrModalVisible.value = false

const downloadQr = (dataUrl, name) => {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${name}.png`
  a.click()
}

/* ================= LOGOUT ================= */
const logout = () => {
  localStorage.clear()
  router.push('/login')
}

/* ================= MOUNT ================= */
onMounted(async () => {
  user.value.role = localStorage.getItem('role') || 'guru'
  user.value.name = localStorage.getItem('teacherName') || 'Guru'
  user.value.mapel = localStorage.getItem('teacherMapel') || 'RPL'

  await loadStudents()
  await loadSchedule()
})

onUnmounted(stopQrScan)
</script>



<template>
<div class="dashboard">

  <!-- HEADER -->
  <header class="header">
    <div class="left">
      <div class="avatar">{{ avatarInitial }}</div>
      <div class="info">
        <span class="name">{{ user.name }}</span>
        <span class="role">{{ user.role.toUpperCase() }}</span>
        <span v-if="user.mapel" class="mapel">{{ user.mapel }}</span>
      </div>
    </div>
    <div class="right">
      <button @click="logout" class="logout-btn">🚪 Logout</button>
    </div>
  </header>

  <!-- STATS -->
  <section class="stats" v-if="user.role==='guru'">
    <div class="stat-card">
      <div class="stat-icon hadir"><span class="material-icons">check_circle</span></div>
      <div class="stat-info">
        <span class="value">{{ hadirCount }}</span>
        <span class="label">Hadir Hari Ini</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon total"><span class="material-icons">school</span></div>
      <div class="stat-info">
        <span class="value">{{ students.length }}</span>
        <span class="label">Total Siswa</span>
      </div>
    </div>
  </section>

  <!-- MENU -->
  <section class="menu" v-if="user.role==='guru'">
    <div class="menu-card" @click="startQrScan">
      <div class="menu-icon scanner"><span class="material-icons">qr_code_scanner</span></div>
      <span>Scan QR Absen</span>
    </div>
  </section>

  <!-- SISWA -->
  <section class="activity" v-if="user.role==='guru'">
    <input v-model="searchQuery" placeholder="Cari siswa..." class="search-input" />
    <ul v-if="loadingStudents" class="empty">Memuat siswa...</ul>
    <ul v-else>
      <li v-for="s in filteredStudents" :key="s.nis" class="student-card">
        <div class="student-left">
          <div class="mini-avatar">{{ s.name.charAt(0).toUpperCase() }}</div>
          <div class="detail">
            <strong>{{ s.name }}</strong>
            <small>{{ s.class }} - NIS: {{ s.nis }}</small>
          </div>
          <img v-if="s.qrCode" :src="s.qrCode" class="qr-code" @click="openQrModal(s.qrCode)" />
        </div>
        <div class="status-buttons">
          <button @click="updateStatus(s.nis,'Hadir')" :class="{active:s.status==='Hadir', hadir:true}">🟢 Hadir</button>
          <button @click="updateStatus(s.nis,'Izin')" :class="{active:s.status==='Izin', izin:true}">🟡 Izin</button>
          <button @click="updateStatus(s.nis,'Sakit')" :class="{active:s.status==='Sakit', sakit:true}">🔵 Sakit</button>
          <button @click="updateStatus(s.nis,'Alfa')" :class="{active:s.status==='Alfa', alfa:true}">🔴 Alfa</button>
          <button @click="resetStatus(s.nis)" class="reset-btn">♻ Reset</button>
        </div>
        <span v-if="s.status" class="current-status">{{ s.status }}</span>
      </li>
    </ul>

    <div v-if="qrScannerVisible" id="qr-reader" class="qr-scanner"></div>
    <p v-if="qrResult">{{ qrResult }}</p>

    <!-- QR MODAL -->
    <div v-if="qrModalVisible" class="modal-overlay">
      <div class="modal-content">
        <button @click="closeQrModal" class="close-btn">&times;</button>
        <img :src="selectedQr" class="modal-qr" />
        <button @click="downloadQr(selectedQr,'QR_Code')" class="download-btn">Download QR</button>
      </div>
    </div>
  </section>

  <!-- JADWAL -->
  <section class="schedule">
    <h3>Jadwal Pelajaran</h3>
    <ul v-if="loadingSchedule" class="empty">Memuat jadwal...</ul>
    <ul v-else>
      <li v-for="sc in schedule" :key="sc._id" class="schedule-item">
        <strong>{{ sc.mapel }}</strong> - {{ sc.hari }}, {{ sc.jam }}
        <small>Guru: {{ sc.guru }}</small>
      </li>
    </ul>
  </section>
</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');

.dashboard { background:#f0f2f5; min-height:100vh; padding:20px; font-family:'Inter',sans-serif; }

/* HEADER */
.header { display:flex; justify-content:space-between; align-items:center; background:white; padding:14px 20px; border-radius:16px; box-shadow:0 6px 20px rgba(0,0,0,0.08); margin-bottom:24px; }
.left { display:flex; align-items:center; gap:14px; }
.avatar { width:52px; height:52px; border-radius:50%; background:linear-gradient(135deg,#4f46e5,#8b5cf6); color:white; display:flex; justify-content:center; align-items:center; font-weight:700; font-size:1.4rem; box-shadow:0 4px 10px rgba(0,0,0,0.1); }
.info .name { font-weight:700; color:#111827; display:block; font-size:1rem; }
.info .role,.info .mapel { font-size:.75rem; color:#6b7280; display:block; }
.right { display:flex; align-items:center; gap:12px; }
.logout-btn { padding:8px 16px; border:none; border-radius:12px; background:#ef4444; color:white; cursor:pointer; font-size:.8rem; box-shadow:0 4px 10px rgba(0,0,0,0.1); transition:0.2s; }
.logout-btn:hover { transform:scale(1.05); }

/* STATS */
.stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:16px; margin-bottom:24px; }
.stat-card { display:flex; align-items:center; background:white; border-radius:16px; padding:16px; gap:14px; box-shadow:0 6px 20px rgba(0,0,0,0.08); transition:0.2s; }
.stat-card:hover { transform:translateY(-2px); }
.stat-icon { width:56px; height:56px; border-radius:14px; display:flex; justify-content:center; align-items:center; color:white; font-size:1.8rem; box-shadow:0 3px 6px rgba(0,0,0,0.1); }
.stat-icon.hadir { background:#10b981 }
.stat-icon.total { background:#3b82f6 }
.stat-info .value { font-size:1.3rem; font-weight:700; color:#111827; }
.stat-info .label { font-size:.75rem; color:#6b7280; }

/* MENU */
.menu { display:flex; gap:14px; margin-bottom:24px; flex-wrap:wrap; }
.menu-card { background:white; border-radius:16px; padding:14px; display:flex; align-items:center; gap:12px; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.08); transition:0.2s; font-weight:600; }
.menu-card:hover { transform:translateY(-2px) scale(1.02); }
.menu-icon { width:46px; height:46px; border-radius:12px; display:flex; justify-content:center; align-items:center; color:white; font-size:1.6rem; box-shadow:0 3px 6px rgba(0,0,0,0.1); }
.menu-icon.scanner { background:#8b5cf6; }

/* SISWA */
.student-card { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; background:white; padding:14px; border-radius:16px; margin-bottom:12px; box-shadow:0 4px 12px rgba(0,0,0,0.06); transition:0.2s; }
.student-card:hover { transform:translateY(-2px); }
.student-left { display:flex; align-items:center; gap:14px; flex:1 1 250px; }
.mini-avatar { width:44px; height:44px; border-radius:50%; background:#4f46e5; color:white; display:flex; justify-content:center; align-items:center; font-weight:700; font-size:1rem; box-shadow:0 2px 6px rgba(0,0,0,0.1); }
.detail strong { display:block; font-size:0.95rem; color:#111827; }
.detail small { display:block; color:#6b7280; font-size:0.75rem; }
.qr-code { width:60px; height:60px; border:1px solid #e5e7eb; border-radius:12px; cursor:pointer; transition:0.2s; }
.qr-code:hover { transform:scale(1.05); }

/* STATUS BUTTONS */
.status-buttons { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.status-buttons button { padding:6px 12px; border-radius:12px; border:none; cursor:pointer; font-size:.75rem; transition:0.2s; font-weight:600; }
.status-buttons button.active { color:white; }
.status-buttons button.hadir { background:#10b981; color:white; }
.status-buttons button.izin { background:#facc15; color:#111827; }
.status-buttons button.sakit { background:#3b82f6; color:white; }
.status-buttons button.alfa { background:#ef4444; color:white; }
.reset-btn { background:#9ca3af; color:white; }
.current-status { font-size:.75rem; font-weight:600; margin-left:10px; margin-top:4px; }

/* INPUT */
.search-input { width:100%; padding:10px 14px; border-radius:14px; border:1px solid #d1d5db; margin-bottom:14px; font-size:0.9rem; }

/* QR SCANNER */
.qr-scanner { width:100%; max-width:400px; margin-top:16px; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1); }

/* MODAL */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:50; }
.modal-content { background:white; border-radius:16px; padding:20px; position:relative; display:flex; flex-direction:column; align-items:center; gap:16px; width:280px; }
.close-btn { position:absolute; top:10px; right:10px; font-size:1.5rem; background:none; border:none; cursor:pointer; }
.modal-qr { width:220px; height:220px; object-fit:contain; border-radius:16px; }
.download-btn { background:#8b5cf6; color:white; padding:10px 16px; border-radius:12px; cursor:pointer; font-weight:600; transition:0.2s; }
.download-btn:hover { transform:scale(1.05); }

/* JADWAL */
.schedule { margin-top:24px; }
.schedule-item { display:flex; justify-content:space-between; padding:14px; background:white; border-radius:16px; margin-bottom:12px; box-shadow:0 4px 12px rgba(0,0,0,0.06); transition:0.2s; }
.schedule-item:hover { transform:translateY(-2px); }
.empty { text-align:center; color:#9ca3af; padding:20px; font-size:0.9rem; }

/* RESPONSIVE */
@media (max-width:768px){
  .stats { grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); }
  .student-card { flex-direction:column; align-items:flex-start; }
  .status-buttons { justify-content:flex-start; }
}
</style>
