import axios from 'axios'

const API = 'https://backend-test-n4bo.vercel.app'

export const loginGuru = async (payload) => {
  const res = await axios.post(`${API}/auth/login`, payload)
  return res.data
}
