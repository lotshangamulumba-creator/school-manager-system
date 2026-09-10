-- =============================================================================
-- TIC-TiG - Base de données Relationnelle PostgreSQL
-- Complexe Scolaire Privé CEMINACE (Brazzaville, République du Congo)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table Utilisateurs (Authentification & Rôles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    telephone VARCHAR(50),
    role VARCHAR(20) NOT NULL DEFAULT 'TEACHER' CHECK (role IN ('ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'PARENT', 'STUDENT')),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Années Scolaires
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enseignants
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    specialite VARCHAR(100),
    statut BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Classes
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    niveau VARCHAR(20) NOT NULL CHECK (niveau IN ('PRIMAIRE', 'COLLEGE', 'LYCEE')),
    section VARCHAR(100),
    capacite INT NOT NULL DEFAULT 45,
    statut BOOLEAN NOT NULL DEFAULT TRUE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    head_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_class_year UNIQUE (nom, academic_year_id)
);

-- 5. Matières
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    niveau VARCHAR(20) NOT NULL CHECK (niveau IN ('PRIMAIRE', 'COLLEGE', 'LYCEE')),
    specialty VARCHAR(20) NOT NULL DEFAULT 'Sciences' CHECK (specialty IN ('Sciences', 'Litterature', 'EPS', 'Autre')),
    statut BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Association Classe - Matière (avec coefficient personnalisable)
CREATE TABLE IF NOT EXISTS class_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    coeff NUMERIC(4, 2) NOT NULL DEFAULT 2.00,
    CONSTRAINT uq_class_subject UNIQUE (class_id, subject_id)
);

-- 7. Élèves
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matricule VARCHAR(50) NOT NULL UNIQUE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    sexe CHAR(1) NOT NULL CHECK (sexe IN ('M', 'F')),
    date_naissance VARCHAR(20) NOT NULL,
    lieu_naissance VARCHAR(150),
    adresse TEXT,
    telephone VARCHAR(50),
    email VARCHAR(255),
    photo_url TEXT,
    statut BOOLEAN NOT NULL DEFAULT TRUE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Notes & Évaluations (Barème officiel CEMINACE Congo)
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    term VARCHAR(20) NOT NULL CHECK (term IN ('TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3')),
    evaluations NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (evaluations >= 0 AND evaluations <= 20),
    dev1 NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (dev1 >= 0 AND dev1 <= 20),
    dev2 NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (dev2 >= 0 AND dev2 <= 20),
    composition NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (composition >= 0 AND composition <= 20),
    observation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_subject_term UNIQUE (student_id, subject_id, term, academic_year_id)
);

-- 9. Audit Logs & Journalisation des opérations sensibles
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_class_term ON grades(class_id, term);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
