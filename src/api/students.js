import axios from 'axios'

export async function getStudents() {
  const res = await axios.get('https://backend-test-n4bo.vercel.app/students')
  return res.data
}
