// Service API Client pour MonPilot School ERP

const API_BASE = '/api';

export interface UserProfile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'PARENT' | 'STUDENT';
  telephone?: string;
}

export interface ApiStudent {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  dateNaissance: string;
  lieuNaissance?: string;
  parentPhone?: string;
  classId: string;
  className: string;
  statut: boolean;
}

export interface ApiClass {
  id: string;
  nom: string;
  niveau: 'Primaire' | 'Collège' | 'Lycée';
  section?: string;
  capacite: number;
  statut: boolean;
  academicYearId: string;
  headTeacherId?: string;
}

export interface ApiSubject {
  id: string;
  nom: string;
  code: string;
  niveau: 'Primaire' | 'Collège' | 'Lycée';
  specialty: 'Sciences' | 'Littérature' | 'EPS' | 'Autre';
  coeff: number;
  statut: boolean;
}

export interface ApiTeacher {
  id: string;
  userId?: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  specialite?: string;
  statut: boolean;
}

export interface ApiGrade {
  id: string;
  studentId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  teacherId?: string;
  term: '1er Trimestre' | '2ème Trimestre' | '3ème Trimestre';
  evaluations: number;
  dev1: number;
  dev2: number;
  composition: number;
  observation?: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    try {
      this.token = typeof window !== 'undefined' ? localStorage.getItem('tictig_jwt_token') : null;
    } catch {
      this.token = null;
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem('tictig_jwt_token', token);
      } else {
        localStorage.removeItem('tictig_jwt_token');
      }
    } catch {
      // Ignorer si localStorage est restreint en iframe ou navigation privée
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Session expirée
      this.setToken(null);
      window.dispatchEvent(new Event('tictig_unauthorized'));
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Erreur serveur HTTP ${response.status}`);
    }

    return data as T;
  }

  // --- Auth ---
  async login(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const res = await this.request<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // --- Students ---
  async getStudents(params?: { classId?: string; className?: string; search?: string }): Promise<ApiStudent[]> {
    const query = new URLSearchParams();
    if (params?.classId) query.set('classId', params.classId);
    if (params?.className) query.set('className', params.className);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return this.request<ApiStudent[]>(`/students${qs ? `?${qs}` : ''}`);
  }

  async createStudent(student: Partial<ApiStudent>): Promise<ApiStudent> {
    return this.request<ApiStudent>('/students', {
      method: 'POST',
      body: JSON.stringify(student),
    });
  }

  async updateStudent(id: string, updates: Partial<ApiStudent>): Promise<ApiStudent> {
    return this.request<ApiStudent>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteStudent(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  async batchImportStudents(students: any[], targetClassId: string, targetClassName: string): Promise<{ importedCount: number; total: number }> {
    return this.request<{ importedCount: number; total: number }>('/students/batch-import', {
      method: 'POST',
      body: JSON.stringify({ students, targetClassId, targetClassName }),
    });
  }

  // --- Classes & Subjects ---
  async getClasses(): Promise<ApiClass[]> {
    return this.request<ApiClass[]>('/classes');
  }

  async createClass(cls: Partial<ApiClass>): Promise<ApiClass> {
    return this.request<ApiClass>('/classes', {
      method: 'POST',
      body: JSON.stringify(cls),
    });
  }

  async updateClass(id: string, updates: Partial<ApiClass>): Promise<ApiClass> {
    return this.request<ApiClass>(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getSubjects(): Promise<ApiSubject[]> {
    return this.request<ApiSubject[]>('/subjects');
  }

  async createSubject(sub: Partial<ApiSubject>): Promise<ApiSubject> {
    return this.request<ApiSubject>('/subjects', {
      method: 'POST',
      body: JSON.stringify(sub),
    });
  }

  async updateSubject(id: string, updates: Partial<ApiSubject>): Promise<ApiSubject> {
    return this.request<ApiSubject>(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // --- Teachers ---
  async getTeachers(): Promise<ApiTeacher[]> {
    return this.request<ApiTeacher[]>('/teachers');
  }

  async createTeacher(teacher: any): Promise<ApiTeacher> {
    return this.request<ApiTeacher>('/teachers', {
      method: 'POST',
      body: JSON.stringify(teacher),
    });
  }

  // --- Grades & Results ---
  async getGrades(params: { classId?: string; className?: string; term?: string }): Promise<ApiGrade[]> {
    const query = new URLSearchParams();
    if (params.classId) query.set('classId', params.classId);
    if (params.className) query.set('className', params.className);
    if (params.term) query.set('term', params.term);
    const qs = query.toString();
    return this.request<ApiGrade[]>(`/grades${qs ? `?${qs}` : ''}`);
  }

  async saveBatchGrades(payload: { grades: any[]; classId: string; className: string; term: string }): Promise<{ success: boolean; updatedCount: number }> {
    return this.request<{ success: boolean; updatedCount: number }>('/grades/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getClassResults(classId: string, term: string): Promise<any> {
    return this.request<any>(`/results/class/${encodeURIComponent(classId)}?term=${encodeURIComponent(term)}`);
  }

  async getDashboardStats(term: string): Promise<any> {
    return this.request<any>(`/stats/dashboard?term=${encodeURIComponent(term)}`);
  }

  // --- Backup & Audit ---
  async getAuditLogs(): Promise<any[]> {
    return this.request<any[]>('/audit-logs');
  }

  async restoreBackup(backupData: any): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData }),
    });
  }
}

export const api = new ApiService();
