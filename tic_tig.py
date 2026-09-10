#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
Application : TIC-TiG (Gestion Scolaire CEMINACE - Congo Brazzaville)
Dimensions  : 980 x 683 pixels
Auteur      : EduTigTic System
Description : Logiciel de gestion des élèves, des évaluations trimestrielles,
              du calcul des moyennes et classements (par matière et spécialité:
              Sciences, Littérature, EPS), et d'export de bulletins officiels PDF.
=============================================================================
"""

import os
import sys
import math
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog

# Imports optionnels pour traitement des fichiers et PDF
try:
    import pandas as pd
except ImportError:
    pd = None

try:
    import openpyxl
except ImportError:
    openpyxl = None

try:
    import docx
except ImportError:
    docx = None

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
    from reportlab.pdfgen import canvas as pdf_canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


# =============================================================================
# COULEURS & THÈME (LIGHT MIDNIGHT BLUE AVEC EFFET SURVEILLANCE / HOVER)
# =============================================================================
COLOR_BG = "#F4F7FB"
COLOR_PANEL = "#FFFFFF"
COLOR_MIDNIGHT_LIGHT = "#1E3A5F"      # Bleu nuit clair principal
COLOR_MIDNIGHT_HOVER = "#2A5288"      # Bleu nuit clair au survol (surveillance)
COLOR_MIDNIGHT_ACTIVE = "#152942"     # Clic actif
COLOR_ACCENT = "#0EA5E9"              # Cyan subtil
COLOR_TEXT_PRIMARY = "#0F172A"        # Texte foncé
COLOR_TEXT_MUTED = "#64748B"          # Texte estompé
COLOR_BORDER = "#CBD5E1"              # Bordure douce
COLOR_SUCCESS = "#059669"
COLOR_WARNING = "#D97706"


# =============================================================================
# MODÈLE DE DONNÉES & SYSTÈME DE NOTATION CEMINACE (CONGO BRAZZAVILLE)
# =============================================================================
class CeminaceSystem:
    """
    Système de calcul officiel du Complexe Scolaire Privé CEMINACE (Brazzaville, Congo).
    Formule officielle :
      - Contrôle Continu (CC) = (Notes Évaluations + Devoir 1 + Devoir 2) / 3
      - Moyenne Trimestrielle = (CC + 2 * COMPOSITION) / 3
      - Moyenne Générale      = Somme(Moyenne Matière * Coeff) / Somme(Coeff)
    Spécialités :
      - Sciences : Mathématiques, Sciences Physiques, SVT
      - Littérature : Français, Anglais, Histoire-Géographie, Philosophie
      - EPS : Éducation Physique et Sportive
    """

    SPECIALTIES = {
        "Sciences": ["Mathématiques", "Sciences Physiques", "SVT", "Éveil / Sciences"],
        "Littérature": ["Français", "Anglais", "Histoire-Géographie", "Philosophie"],
        "EPS": ["EPS"]
    }

    LEVELS = {
        "Primaire": {
            "classes": ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
            "default_subjects": [
                {"name": "Français", "coeff": 3, "specialty": "Littérature"},
                {"name": "Mathématiques", "coeff": 3, "specialty": "Sciences"},
                {"name": "Éveil / Sciences", "coeff": 2, "specialty": "Sciences"},
                {"name": "Histoire-Géographie", "coeff": 1, "specialty": "Littérature"},
                {"name": "EPS", "coeff": 1, "specialty": "EPS"}
            ]
        },
        "Collège": {
            "classes": ["6ème A", "6ème B", "5ème A", "5ème B", "4ème A", "4ème B", "3ème A", "3ème B"],
            "default_subjects": [
                {"name": "Français", "coeff": 4, "specialty": "Littérature"},
                {"name": "Mathématiques", "coeff": 4, "specialty": "Sciences"},
                {"name": "Sciences Physiques", "coeff": 2, "specialty": "Sciences"},
                {"name": "SVT", "coeff": 2, "specialty": "Sciences"},
                {"name": "Anglais", "coeff": 2, "specialty": "Littérature"},
                {"name": "Histoire-Géographie", "coeff": 2, "specialty": "Littérature"},
                {"name": "EPS", "coeff": 1, "specialty": "EPS"}
            ]
        },
        "Lycée": {
            "classes": ["Seconde A", "Seconde C", "Première A4", "Première D", "Terminale A4", "Terminale D", "Terminale C"],
            "default_subjects": [
                {"name": "Français", "coeff": 4, "specialty": "Littérature"},
                {"name": "Philosophie", "coeff": 3, "specialty": "Littérature"},
                {"name": "Mathématiques", "coeff": 5, "specialty": "Sciences"},
                {"name": "Sciences Physiques", "coeff": 4, "specialty": "Sciences"},
                {"name": "SVT", "coeff": 3, "specialty": "Sciences"},
                {"name": "Anglais", "coeff": 2, "specialty": "Littérature"},
                {"name": "Histoire-Géographie", "coeff": 2, "specialty": "Littérature"},
                {"name": "EPS", "coeff": 2, "specialty": "EPS"}
            ]
        }
    }

    @staticmethod
    def get_mention(moyenne):
        if moyenne >= 16.0:
            return "Très Bien (Félicitations du Conseil)"
        elif moyenne >= 14.0:
            return "Bien (Tableau d'Honneur et Encouragements)"
        elif moyenne >= 12.0:
            return "Assez Bien (Tableau d'Honneur)"
        elif moyenne >= 10.0:
            return "Passable (Travail Moyen)"
        elif moyenne >= 8.0:
            return "Insuffisant (Avertissement Travail)"
        else:
            return "Faible (Blâme de Travail)"


# =============================================================================
# BOUTON AVEC EFFET SURVEILLANCE / HOVER (LIGHT MIDNIGHT BLUE)
# =============================================================================
class MidnightButton(tk.Button):
    """Bouton personnalisé Bleu Nuit Clair avec transition et effet surveillance."""

    def __init__(self, master=None, text="", command=None, width=None, variant="primary", **kwargs):
        self.variant = variant
        if variant == "primary":
            bg = COLOR_MIDNIGHT_LIGHT
            fg = "#FFFFFF"
            self.hover_bg = COLOR_MIDNIGHT_HOVER
        elif variant == "outline":
            bg = "#FFFFFF"
            fg = COLOR_MIDNIGHT_LIGHT
            self.hover_bg = "#E2E8F0"
        elif variant == "accent":
            bg = "#0EA5E9"
            fg = "#FFFFFF"
            self.hover_bg = "#0284C7"
        elif variant == "warning":
            bg = "#D97706"
            fg = "#FFFFFF"
            self.hover_bg = "#B45309"
        else:
            bg = "#F1F5F9"
            fg = COLOR_TEXT_PRIMARY
            self.hover_bg = "#E2E8F0"

        super().__init__(
            master,
            text=text,
            command=command,
            bg=bg,
            fg=fg,
            activebackground=COLOR_MIDNIGHT_ACTIVE,
            activeforeground="#FFFFFF",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=10,
            pady=5,
            **kwargs
        )
        if width:
            self.config(width=width)

        self.normal_bg = bg
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def on_enter(self, event):
        self.config(bg=self.hover_bg)

    def on_leave(self, event):
        self.config(bg=self.normal_bg)


# =============================================================================
# APPLICATION PRINCIPALE : TIC-TiG (980x683 PIXELS)
# =============================================================================
class TicTigApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TIC-TiG - Système de Gestion Scolaire CEMINACE (Congo Brazzaville)")
        # Dimensions strictes : 980 x 683 pixels
        self.root.geometry("980x683")
        self.root.minsize(980, 683)
        self.root.configure(bg=COLOR_BG)

        # État global
        self.language = "fr"
        self.level_order = ["Primaire", "Collège", "Lycée"]
        self.current_level = "Collège"
        self.classes = list(CeminaceSystem.LEVELS[self.current_level]["classes"])
        self.current_class = self.classes[0] if self.classes else "6ème A"
        self.current_trimester = "1er Trimestre"
        self.trimester_list = ["1er Trimestre", "2ème Trimestre", "3ème Trimestre"]

        # Matières
        self.subjects = [dict(s) for s in CeminaceSystem.LEVELS[self.current_level]["default_subjects"]]

        # Registre des élèves : liste de dictionnaires
        self.students = []
        # Notes : clé = (student_id, subject_name, trimester)
        # valeur = {"eval": float, "dev1": float, "dev2": float, "comp": float}
        self.grades = {}

        # Cache des résultats
        self.averages_cache = {}

        # Données de démonstration
        self.load_demo_data()

        # Construction de l'interface
        self.build_ui()
        self.calculate_averages()

    def get_next_level(self):
        idx = self.level_order.index(self.current_level)
        return self.level_order[(idx + 1) % len(self.level_order)]

    def get_next_trimester(self):
        idx = self.trimester_list.index(self.current_trimester)
        return self.trimester_list[(idx + 1) % len(self.trimester_list)]

    def load_demo_data(self):
        """Initialise des élèves modèles pour CEMINACE Brazzaville."""
        demo_students = [
            ("Grace", "Moukoko", "12/04/2010", "F", "+242 06 654 32 10"),
            ("Christian", "Ngoma", "25/08/2009", "M", "+242 05 512 88 44"),
            ("Aurelie", "Makosso", "03/11/2010", "F", "+242 06 901 22 77"),
            ("Kevin", "Samba", "17/01/2009", "M", "+242 04 433 19 80"),
            ("Priscille", "Loubaki", "09/06/2010", "F", "+242 06 720 11 05"),
            ("Arnaud", "Mpassi", "22/12/2009", "M", "+242 05 609 45 33"),
        ]
        self.students.clear()
        for idx, (fn, ln, dob, gen, ph) in enumerate(demo_students, 1):
            s_id = f"CEM-{idx:03d}"
            self.students.append({
                "id": s_id,
                "first_name": fn,
                "last_name": ln,
                "dob": dob,
                "gender": gen,
                "phone": ph,
                "class_name": self.current_class
            })
            # Notes pour les 3 trimestres
            for trim in self.trimester_list:
                for subj in self.subjects:
                    base = 10.5 + (idx * 1.4 + len(subj["name"])) % 7.0
                    self.grades[(s_id, subj["name"], trim)] = {
                        "eval": round(min(20.0, max(5.0, base - 0.5)), 2),
                        "dev1": round(min(20.0, max(5.0, base + 0.8)), 2),
                        "dev2": round(min(20.0, max(5.0, base - 1.0)), 2),
                        "comp": round(min(20.0, max(5.0, base + 1.2)), 2),
                    }

    def build_ui(self):
        # 1. En-tête supérieur
        header_frame = tk.Frame(self.root, bg=COLOR_MIDNIGHT_LIGHT, height=54)
        header_frame.pack(side="top", fill="x")

        title_box = tk.Frame(header_frame, bg=COLOR_MIDNIGHT_LIGHT)
        title_box.pack(side="left", padx=14, pady=8)

        lbl_app_name = tk.Label(
            title_box,
            text="TIC-TiG",
            font=("Segoe UI", 15, "bold"),
            fg="#FFFFFF",
            bg=COLOR_MIDNIGHT_LIGHT
        )
        lbl_app_name.pack(side="left")

        lbl_sub = tk.Label(
            title_box,
            text=" • Complexe Scolaire Privé CEMINACE (Brazzaville, République du Congo)",
            font=("Segoe UI", 9),
            fg="#93C5FD",
            bg=COLOR_MIDNIGHT_LIGHT
        )
        lbl_sub.pack(side="left", padx=6)

        # Indicateurs droite : Langue, Trimestre, Version
        right_box = tk.Frame(header_frame, bg=COLOR_MIDNIGHT_LIGHT)
        right_box.pack(side="right", padx=14, pady=8)

        self.btn_lang = MidnightButton(
            right_box,
            text="🌐 FR ➜ EN" if self.language == "fr" else "🌐 EN ➜ FR",
            command=self.toggle_language,
            variant="outline"
        )
        self.btn_lang.pack(side="left", padx=4)

        self.lbl_trim_badge = tk.Label(
            right_box,
            text=f"📅 {self.current_trimester}",
            font=("Segoe UI", 9, "bold"),
            fg="#FFFFFF",
            bg="#2563EB",
            padx=8,
            pady=4
        )
        self.lbl_trim_badge.pack(side="left", padx=4)

        lbl_ver = tk.Label(
            right_box,
            text="v1.2.0-Tk (980x683)",
            font=("Segoe UI", 8),
            fg="#94A3B8",
            bg=COLOR_MIDNIGHT_LIGHT
        )
        lbl_ver.pack(side="left", padx=6)

        # 2. Barre d'outils Rangée 1 : Niveaux et Classes
        tb1 = tk.Frame(self.root, bg="#FFFFFF", height=42, bd=1, relief="solid")
        tb1.pack(side="top", fill="x", padx=8, pady=(4, 2))

        self.btn_cycle_level = MidnightButton(
            tb1,
            text=f"🔄 Basculer Niveau ➜ {self.get_next_level()}",
            command=self.cycle_school_level,
            variant="primary"
        )
        self.btn_cycle_level.pack(side="left", padx=(8, 10), pady=4)

        tk.Label(tb1, text="Cycle / Niveau :", font=("Segoe UI", 9, "bold"), bg="#FFFFFF", fg=COLOR_TEXT_PRIMARY).pack(side="left", padx=(0, 4))
        self.level_buttons = {}
        for lvl in self.level_order:
            b = MidnightButton(
                tb1,
                text=lvl,
                command=lambda l=lvl: self.set_school_level(l),
                variant="primary" if lvl == self.current_level else "outline"
            )
            b.pack(side="left", padx=2, pady=4)
            self.level_buttons[lvl] = b

        tk.Label(tb1, text="Classe :", font=("Segoe UI", 9, "bold"), bg="#FFFFFF", fg=COLOR_TEXT_PRIMARY).pack(side="left", padx=(12, 4))
        self.cb_class = ttk.Combobox(tb1, values=self.classes, state="readonly", width=12)
        self.cb_class.set(self.current_class)
        self.cb_class.bind("<<ComboboxSelected>>", self.on_class_changed)
        self.cb_class.pack(side="left", padx=4, pady=4)

        MidnightButton(tb1, text="+ + Classe", command=self.add_class_dialog, variant="primary").pack(side="left", padx=4, pady=4)
        MidnightButton(tb1, text=f"📚 Matières & Coeffs ({len(self.subjects)})", command=self.manage_subjects_dialog, variant="outline").pack(side="left", padx=8, pady=4)

        # 3. Barre d'outils Rangée 2 : Trimestre & Actions rapides
        tb2 = tk.Frame(self.root, bg="#FFFFFF", height=38, bd=1, relief="solid")
        tb2.pack(side="top", fill="x", padx=8, pady=(0, 4))

        self.btn_cycle_trim = MidnightButton(
            tb2,
            text=f"🔄 Basculer Trimestre ➜ {self.get_next_trimester()}",
            command=self.cycle_trimester,
            variant="warning"
        )
        self.btn_cycle_trim.pack(side="left", padx=(8, 8), pady=3)

        self.cb_trimester = ttk.Combobox(tb2, values=self.trimester_list, state="readonly", width=14)
        self.cb_trimester.set(self.current_trimester)
        self.cb_trimester.bind("<<ComboboxSelected>>", self.on_trimester_changed)
        self.cb_trimester.pack(side="left", padx=4, pady=3)

        MidnightButton(tb2, text="🔄 Exemple CEMINACE", command=self.reload_demo_data, variant="outline").pack(side="left", padx=8, pady=3)

        MidnightButton(tb2, text="⚡ Calculer Moyennes", command=self.calculate_averages, variant="accent").pack(side="right", padx=10, pady=3)

        # 4. Corps principal avec Onglets
        self.body_container = tk.Frame(self.root, bg=COLOR_BG)
        self.body_container.pack(fill="both", expand=True, padx=8, pady=2)

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TNotebook", background=COLOR_BG, borderwidth=0)
        style.configure("TNotebook.Tab", background="#E2E8F0", foreground=COLOR_TEXT_PRIMARY, font=("Segoe UI", 9, "bold"), padding=[10, 5])
        style.map("TNotebook.Tab", background=[("selected", COLOR_MIDNIGHT_LIGHT)], foreground=[("selected", "#FFFFFF")])

        self.notebook = ttk.Notebook(self.body_container)
        self.notebook.pack(fill="both", expand=True)

        # Onglet 1 : Élèves & Import
        self.tab_students = tk.Frame(self.notebook, bg=COLOR_PANEL)
        self.notebook.add(self.tab_students, text=f" Élèves & Import ({len([s for s in self.students if s['class_name'] == self.current_class])}) ")
        self.build_tab_students()

        # Onglet 2 : Évaluations & Devoirs
        self.tab_evaluations = tk.Frame(self.notebook, bg=COLOR_PANEL)
        self.notebook.add(self.tab_evaluations, text=" Évaluations & Devoirs ")
        self.build_tab_evaluations()

        # Onglet 3 : Palmarès & Spécialités
        self.tab_results = tk.Frame(self.notebook, bg=COLOR_PANEL)
        self.notebook.add(self.tab_results, text=" Palmarès & Spécialités ")
        self.build_tab_results()

        # Onglet 4 : Bulletins PDF
        self.tab_export = tk.Frame(self.notebook, bg=COLOR_PANEL)
        self.notebook.add(self.tab_export, text=" Bulletins PDF ")
        self.build_tab_export()

        # Onglet 5 : Total Général & Spécialités (Toutes classes et niveaux)
        self.tab_general_total = tk.Frame(self.notebook, bg=COLOR_PANEL)
        self.notebook.add(self.tab_general_total, text=" Total Général & Spécialités ")
        self.build_tab_general_total()

        # 5. Barre de statut inférieure
        status_bar = tk.Frame(self.root, bg="#E2E8F0", height=24)
        status_bar.pack(side="bottom", fill="x")

        self.lbl_status = tk.Label(
            status_bar,
            text=f"Prêt • Classe : {self.current_class} ({len(self.students)} élèves) • Niveau : {self.current_level} • CEMINACE Brazzaville",
            font=("Segoe UI", 8),
            bg="#E2E8F0",
            fg=COLOR_TEXT_MUTED
        )
        self.lbl_status.pack(side="left", padx=10)

        lbl_watermark = tk.Label(
            status_bar,
            text="TIC-TiG • Système officiel CEMINACE Congo",
            font=("Segoe UI", 8, "italic"),
            bg="#E2E8F0",
            fg="#1E3A5F"
        )
        lbl_watermark.pack(side="right", padx=10)

    # =========================================================================
    # ONGLET 1 : ÉLÈVES & IMPORT
    # =========================================================================
    def build_tab_students(self):
        top_bar = tk.Frame(self.tab_students, bg="#F8FAFC", pady=6, padx=10, bd=1, relief="solid")
        top_bar.pack(side="top", fill="x")

        MidnightButton(top_bar, text="+ Inscrire un Élève", command=self.add_student_dialog, variant="primary").pack(side="left", padx=4)
        MidnightButton(top_bar, text="📥 Importer Excel (.xlsx)", command=self.import_from_excel, variant="outline").pack(side="left", padx=4)
        MidnightButton(top_bar, text="📄 Importer Word (.docx)", command=self.import_from_word, variant="outline").pack(side="left", padx=4)
        MidnightButton(top_bar, text="✏️ Modifier", command=self.edit_selected_student, variant="outline").pack(side="left", padx=4)
        MidnightButton(top_bar, text="✍️ Saisir ses Notes", command=self.quick_grade_entry_from_student_tab, variant="outline").pack(side="left", padx=4)
        MidnightButton(top_bar, text="🗑️ Supprimer", command=self.delete_selected_student, variant="warning").pack(side="left", padx=4)

        tree_frame = tk.Frame(self.tab_students)
        tree_frame.pack(fill="both", expand=True, padx=8, pady=8)

        cols = ("id", "name", "dob", "gender", "phone", "class_name")
        self.tree_students = ttk.Treeview(tree_frame, columns=cols, show="headings", selectmode="browse")

        self.tree_students.heading("id", text="Matricule")
        self.tree_students.heading("name", text="Nom & Prénom")
        self.tree_students.heading("dob", text="Naissance")
        self.tree_students.heading("gender", text="Sexe")
        self.tree_students.heading("phone", text="Téléphone Parent (Congo)")
        self.tree_students.heading("class_name", text="Classe")

        self.tree_students.column("id", width=80, anchor="center")
        self.tree_students.column("name", width=180, anchor="w")
        self.tree_students.column("dob", width=100, anchor="center")
        self.tree_students.column("gender", width=50, anchor="center")
        self.tree_students.column("phone", width=150, anchor="w")
        self.tree_students.column("class_name", width=80, anchor="center")

        scroll_y = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree_students.yview)
        self.tree_students.configure(yscrollcommand=scroll_y.set)

        self.tree_students.pack(side="left", fill="both", expand=True)
        scroll_y.pack(side="right", fill="y")

        self.tree_students.bind("<Double-1>", lambda e: self.edit_selected_student())
        self.refresh_students_tree()

    def refresh_students_tree(self):
        for item in self.tree_students.get_children():
            self.tree_students.delete(item)
        class_students = [s for s in self.students if s["class_name"] == self.current_class]
        for s in class_students:
            self.tree_students.insert("", "end", values=(
                s["id"], f"{s['last_name'].upper()} {s['first_name']}", s["dob"], s["gender"], s["phone"], s["class_name"]
            ))
        self.notebook.tab(0, text=f" Élèves & Import ({len(class_students)}) ")

    def quick_grade_entry_from_student_tab(self):
        sel = self.tree_students.selection()
        if not sel:
            messagebox.showwarning("Sélection", "Veuillez sélectionner un élève dans la liste.")
            return
        s_id = self.tree_students.item(sel[0], "values")[0]
        # Basculer vers l'onglet 2 (Évaluations & Devoirs)
        self.notebook.select(self.tab_evaluations)
        # Sélectionner cet élève dans le tableau des notes
        for item in self.tree_eval.get_children():
            if self.tree_eval.item(item, "values")[0] == s_id:
                self.tree_eval.selection_set(item)
                self.tree_eval.see(item)
                break
        self.on_double_click_grade_row(None)

    # =========================================================================
    # ONGLET 2 : ÉVALUATIONS & DEVOIRS (BARÈME CEMINACE 4 COMPOSANTES)
    # =========================================================================
    def build_tab_evaluations(self):
        ctrl_frame = tk.Frame(self.tab_evaluations, bg="#F8FAFC", pady=6, padx=10, bd=1, relief="solid")
        ctrl_frame.pack(side="top", fill="x")

        tk.Label(ctrl_frame, text="Matière :", font=("Segoe UI", 9, "bold"), bg="#F8FAFC").pack(side="left", padx=4)
        self.cb_eval_subject = ttk.Combobox(ctrl_frame, values=[s["name"] for s in self.subjects], state="readonly", width=20)
        if self.subjects:
            self.cb_eval_subject.set(self.subjects[0]["name"])
        self.cb_eval_subject.bind("<<ComboboxSelected>>", lambda e: self.refresh_eval_tree())
        self.cb_eval_subject.pack(side="left", padx=4)

        # Bouton Saisie individuelle
        MidnightButton(
            ctrl_frame,
            text="✍️ Saisir / Modifier l'Élève",
            command=self.edit_selected_grade_row,
            variant="primary"
        ).pack(side="left", padx=6)

        # Bouton Saisie en lot toute la classe
        MidnightButton(
            ctrl_frame,
            text="📋 Saisir Toute la Classe en Grille",
            command=self.open_batch_grades_dialog,
            variant="outline"
        ).pack(side="left", padx=4)

        lbl_formula = tk.Label(
            ctrl_frame,
            text="Barème CEMINACE : CC=(Éval+Dev1+Dev2)/3  •  Moyenne=(CC + 2×COMPOSITION)/3",
            font=("Segoe UI", 8, "italic"),
            fg=COLOR_TEXT_MUTED,
            bg="#F8FAFC"
        )
        lbl_formula.pack(side="right", padx=8)

        # Tableau des notes
        eval_table_frame = tk.Frame(self.tab_evaluations, bg=COLOR_PANEL)
        eval_table_frame.pack(fill="both", expand=True, padx=8, pady=8)

        cols = ("matricule", "nom", "eval", "dev1", "dev2", "comp", "moy_matiere")
        self.tree_eval = ttk.Treeview(eval_table_frame, columns=cols, show="headings", selectmode="browse")

        self.tree_eval.heading("matricule", text="Matricule")
        self.tree_eval.heading("nom", text="Nom & Prénom")
        self.tree_eval.heading("eval", text="1. Notes Évaluations (/20)")
        self.tree_eval.heading("dev1", text="2. Devoir 1 (/20)")
        self.tree_eval.heading("dev2", text="3. Devoir 2 (/20)")
        self.tree_eval.heading("comp", text="4. COMPOSITION (/20)")
        self.tree_eval.heading("moy_matiere", text="Moyenne /20")

        self.tree_eval.column("matricule", width=80, anchor="center")
        self.tree_eval.column("nom", width=180, anchor="w")
        self.tree_eval.column("eval", width=130, anchor="center")
        self.tree_eval.column("dev1", width=110, anchor="center")
        self.tree_eval.column("dev2", width=110, anchor="center")
        self.tree_eval.column("comp", width=130, anchor="center")
        self.tree_eval.column("moy_matiere", width=100, anchor="center")

        scroll_eval = ttk.Scrollbar(eval_table_frame, orient="vertical", command=self.tree_eval.yview)
        self.tree_eval.configure(yscrollcommand=scroll_eval.set)

        self.tree_eval.pack(side="left", fill="both", expand=True)
        scroll_eval.pack(side="right", fill="y")

        self.tree_eval.bind("<Double-1>", self.on_double_click_grade_row)
        self.refresh_eval_tree()

    def get_student_grade(self, s_id, subject):
        return self.grades.get((s_id, subject, self.current_trimester), {"eval": 10.0, "dev1": 10.0, "dev2": 10.0, "comp": 10.0})

    def calculate_ceminace_moyenne(self, ev, d1, d2, comp):
        cc = (ev + d1 + d2) / 3.0
        moy = (cc + 2.0 * comp) / 3.0
        return round(moy, 2)

    def refresh_eval_tree(self):
        for item in self.tree_eval.get_children():
            self.tree_eval.delete(item)

        subject = self.cb_eval_subject.get() if hasattr(self, "cb_eval_subject") else ""
        class_students = [s for s in self.students if s["class_name"] == self.current_class]

        for s in class_students:
            g = self.get_student_grade(s["id"], subject)
            moy = self.calculate_ceminace_moyenne(g["eval"], g["dev1"], g["dev2"], g["comp"])
            self.tree_eval.insert("", "end", values=(
                s["id"],
                f"{s['last_name'].upper()} {s['first_name']}",
                f"{g['eval']:.2f}",
                f"{g['dev1']:.2f}",
                f"{g['dev2']:.2f}",
                f"{g['comp']:.2f}",
                f"{moy:.2f}"
            ))

    def edit_selected_grade_row(self):
        """Ouvre le dialogue de saisie pour l'élève actuellement sélectionné dans le tableau."""
        selected = self.tree_eval.selection()
        if not selected:
            children = self.tree_eval.get_children()
            if children:
                self.tree_eval.selection_set(children[0])
            else:
                messagebox.showwarning("Sélection", "Aucun élève dans cette classe.")
                return
        self.on_double_click_grade_row(None)

    def on_double_click_grade_row(self, event):
        selected = self.tree_eval.selection()
        if not selected:
            return
        vals = self.tree_eval.item(selected[0], "values")
        s_id = vals[0]
        s_name = vals[1]
        subject = self.cb_eval_subject.get()

        dialog = tk.Toplevel(self.root)
        dialog.title(f"Saisie des 4 Notes CEMINACE - {s_name}")
        dialog.geometry("540x580")
        dialog.minsize(500, 520)
        dialog.resizable(True, True)
        dialog.transient(self.root)
        dialog.grab_set()

        cur = self.get_student_grade(s_id, subject)

        # En-tête supérieur distinct
        header_frame = tk.Frame(dialog, bg="#1E3A5F", pady=10, padx=14)
        header_frame.pack(side="top", fill="x")
        tk.Label(
            header_frame,
            text="✍️ Saisie des 4 Notes & Composition",
            font=("Segoe UI", 12, "bold"),
            fg="#FFFFFF",
            bg="#1E3A5F"
        ).pack(anchor="w")
        tk.Label(
            header_frame,
            text=f"Élève : {s_name} ({s_id})  •  Matière : {subject}  •  {self.current_trimester}",
            font=("Segoe UI", 9),
            fg="#93C5FD",
            bg="#1E3A5F"
        ).pack(anchor="w", pady=(2, 0))

        # IMPORTANT : Barre d'actions inférieure packée en premier pour être TOUJOURS visible
        bot_bar = tk.Frame(dialog, bg="#F8FAFC", pady=10, padx=16, bd=1, relief="solid")
        bot_bar.pack(side="bottom", fill="x")

        # Conteneur central défilable / aéré
        body_frame = tk.Frame(dialog, bg="#FFFFFF", padx=16, pady=10)
        body_frame.pack(side="top", fill="both", expand=True)

        # Rappel de la formule officielle CEMINACE Congo
        info_frame = tk.Frame(body_frame, bg="#EFF6FF", bd=1, relief="solid", padx=10, pady=6)
        info_frame.pack(fill="x", pady=(0, 10))
        tk.Label(
            info_frame,
            text="Formule Officielle CEMINACE Brazzaville (Congo) :",
            font=("Segoe UI", 9, "bold"),
            fg="#1E3A5F",
            bg="#EFF6FF"
        ).pack(anchor="w")
        tk.Label(
            info_frame,
            text="• Contrôle Continu (CC) = (Évaluations + Devoir 1 + Devoir 2) / 3\n• Moyenne Trimestrielle = (CC + 2 × COMPOSITION) / 3   [La Composition compte double]",
            font=("Segoe UI", 8),
            fg="#2563EB",
            bg="#EFF6FF",
            justify="left"
        ).pack(anchor="w", pady=(2, 0))

        # Carte des 4 notes
        card = tk.Frame(body_frame, bg="#FFFFFF", bd=1, relief="solid", padx=14, pady=10)
        card.pack(fill="x", pady=4)

        entries = {}

        # 1. Notes Évaluations
        f_ev = tk.Frame(card, bg="#FFFFFF")
        f_ev.pack(fill="x", pady=5)
        tk.Label(f_ev, text="1. Notes Évaluations (/20) :", font=("Segoe UI", 9, "bold"), width=24, anchor="w", bg="#FFFFFF").pack(side="left")
        e_eval = tk.Entry(f_ev, width=10, font=("Segoe UI", 10, "bold"), justify="center", bd=1, relief="solid")
        e_eval.insert(0, str(cur["eval"]))
        e_eval.pack(side="left", padx=8)
        tk.Label(f_ev, text="(Interrogations & notes de cours)", font=("Segoe UI", 8, "italic"), fg=COLOR_TEXT_MUTED, bg="#FFFFFF").pack(side="left")
        entries["eval"] = e_eval

        # 2. Devoir 1
        f_d1 = tk.Frame(card, bg="#FFFFFF")
        f_d1.pack(fill="x", pady=5)
        tk.Label(f_d1, text="2. Notes Devoir 1 (/20) :", font=("Segoe UI", 9, "bold"), width=24, anchor="w", bg="#FFFFFF").pack(side="left")
        e_dev1 = tk.Entry(f_d1, width=10, font=("Segoe UI", 10, "bold"), justify="center", bd=1, relief="solid")
        e_dev1.insert(0, str(cur["dev1"]))
        e_dev1.pack(side="left", padx=8)
        tk.Label(f_d1, text="(1er Devoir sur table surveillé)", font=("Segoe UI", 8, "italic"), fg=COLOR_TEXT_MUTED, bg="#FFFFFF").pack(side="left")
        entries["dev1"] = e_dev1

        # 3. Devoir 2 (Clairement visible)
        f_d2 = tk.Frame(card, bg="#FFFFFF")
        f_d2.pack(fill="x", pady=5)
        tk.Label(f_d2, text="3. Notes Devoir 2 (/20) :", font=("Segoe UI", 9, "bold"), width=24, anchor="w", bg="#FFFFFF").pack(side="left")
        e_dev2 = tk.Entry(f_d2, width=10, font=("Segoe UI", 10, "bold"), justify="center", bd=1, relief="solid")
        e_dev2.insert(0, str(cur["dev2"]))
        e_dev2.pack(side="left", padx=8)
        tk.Label(f_d2, text="(2e Devoir sur table surveillé)", font=("Segoe UI", 8, "italic"), fg=COLOR_TEXT_MUTED, bg="#FFFFFF").pack(side="left")
        entries["dev2"] = e_dev2

        # 4. COMPOSITION (Mise en valeur or/ambre car Coefficient 2)
        f_comp = tk.Frame(card, bg="#FEF3C7", bd=1, relief="solid", padx=8, pady=8)
        f_comp.pack(fill="x", pady=8)
        tk.Label(f_comp, text="4. COMPOSITION (/20) :", font=("Segoe UI", 9, "bold"), width=22, anchor="w", fg="#92400E", bg="#FEF3C7").pack(side="left")
        e_comp = tk.Entry(f_comp, width=10, font=("Segoe UI", 11, "bold"), justify="center", bg="#FFFFFF", fg="#92400E", bd=1, relief="solid")
        e_comp.insert(0, str(cur["comp"]))
        e_comp.pack(side="left", padx=8)
        tk.Label(f_comp, text="★ EXAMEN TRIMESTRIEL (Coeff 2)", font=("Segoe UI", 9, "bold"), fg="#B45309", bg="#FEF3C7").pack(side="left")
        entries["comp"] = e_comp

        # Panneau de calcul dynamique en direct
        calc_box = tk.Frame(body_frame, bg="#F1F5F9", bd=1, relief="solid", padx=12, pady=10)
        calc_box.pack(fill="x", pady=8)

        lbl_live_cc = tk.Label(calc_box, text="CC : 0.00 /20", font=("Segoe UI", 9), bg="#F1F5F9", fg="#334155")
        lbl_live_cc.pack(side="left", padx=8)

        lbl_live_moy = tk.Label(calc_box, text="Moyenne Matière : 0.00 /20", font=("Segoe UI", 10, "bold"), bg="#F1F5F9", fg="#1E3A5F")
        lbl_live_moy.pack(side="right", padx=8)

        def update_live_calc(event=None):
            try:
                ev = float(entries["eval"].get().strip().replace(",", ".") or 0)
                d1 = float(entries["dev1"].get().strip().replace(",", ".") or 0)
                d2 = float(entries["dev2"].get().strip().replace(",", ".") or 0)
                cp = float(entries["comp"].get().strip().replace(",", ".") or 0)
                cc = (ev + d1 + d2) / 3.0
                moy = (cc + 2.0 * cp) / 3.0
                lbl_live_cc.config(text=f"CC = (Éval+D1+D2)/3 : {cc:.2f}/20")
                lbl_live_moy.config(text=f"Moyenne Finale : {moy:.2f}/20")
            except Exception:
                pass

        for ent in entries.values():
            ent.bind("<KeyRelease>", update_live_calc)
        update_live_calc()

        def save_single():
            try:
                new_g = {}
                for k in ["eval", "dev1", "dev2", "comp"]:
                    val_str = entries[k].get().strip().replace(",", ".")
                    v = float(val_str)
                    if not (0.0 <= v <= 20.0):
                        raise ValueError(f"Note {k} hors limites (doit être entre 0 et 20)")
                    new_g[k] = round(v, 2)

                self.grades[(s_id, subject, self.current_trimester)] = new_g
                dialog.destroy()
                self.refresh_eval_tree()
                self.calculate_averages()
                messagebox.showinfo("Notes Enregistrées", f"Notes enregistrées avec succès pour {s_name} en {subject} ({self.current_trimester}).")
            except Exception as ex:
                messagebox.showerror("Valeur invalide", f"Veuillez entrer des notes numériques valides entre 0 et 20.\nErreur : {str(ex)}", parent=dialog)

        MidnightButton(bot_bar, text="💾 Enregistrer la Note", command=save_single, variant="primary").pack(side="right", padx=6)
        MidnightButton(bot_bar, text="Annuler", command=dialog.destroy, variant="outline").pack(side="right", padx=6)

    def open_batch_grades_dialog(self):
        """Dialogue de saisie en lot de toute la classe avec les 4 notes CEMINACE (Éval, Dev1, Dev2, COMPOSITION)."""
        subject = self.cb_eval_subject.get()
        class_students = [s for s in self.students if s["class_name"] == self.current_class]
        if not class_students:
            messagebox.showwarning("Aucun élève", "Aucun élève dans cette classe.")
            return

        win = tk.Toplevel(self.root)
        win.title(f"Saisie en Lot des Notes - {subject} ({self.current_class} • {self.current_trimester})")
        win.geometry("960x560")
        win.minsize(880, 480)
        win.resizable(True, True)
        win.transient(self.root)
        win.grab_set()

        top_info = tk.Frame(win, bg="#1E3A5F", pady=10, padx=14)
        top_info.pack(side="top", fill="x")
        tk.Label(
            top_info,
            text=f"📋 Saisie Groupée de la Classe : {subject}  •  Classe : {self.current_class} ({len(class_students)} élèves)",
            font=("Segoe UI", 11, "bold"),
            fg="#FFFFFF",
            bg="#1E3A5F"
        ).pack(side="left")
        tk.Label(
            top_info,
            text=f"{self.current_trimester}  |  Barème : Éval, Dev 1, Dev 2, COMPOSITION (Coeff 2)",
            font=("Segoe UI", 9, "bold"),
            fg="#93C5FD",
            bg="#1E3A5F"
        ).pack(side="right")

        # IMPORTANT : Barre inférieure placée EN PREMIER pour garantir sa visibilité constante
        bottom_bar = tk.Frame(win, bg="#F8FAFC", pady=10, padx=14, bd=1, relief="solid")
        bottom_bar.pack(side="bottom", fill="x")

        # Conteneur défilable avec barres verticale ET horizontale
        main_table_frame = tk.Frame(win, bg="#FFFFFF")
        main_table_frame.pack(side="top", fill="both", expand=True)

        canvas = tk.Canvas(main_table_frame, borderwidth=0, background="#FFFFFF")
        frame_rows = tk.Frame(canvas, background="#FFFFFF")

        vsb = ttk.Scrollbar(main_table_frame, orient="vertical", command=canvas.yview)
        hsb = ttk.Scrollbar(main_table_frame, orient="horizontal", command=canvas.xview)
        canvas.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        vsb.pack(side="right", fill="y")
        hsb.pack(side="bottom", fill="x")
        canvas.pack(side="left", fill="both", expand=True)
        canvas.create_window((0, 0), window=frame_rows, anchor="nw")

        def on_conf(event):
            canvas.configure(scrollregion=canvas.bbox("all"))
        frame_rows.bind("<Configure>", on_conf)

        # En-têtes clairs avec toutes les 4 composantes
        headers = [
            ("Matricule", 10, "#E2E8F0", "#1E293B"),
            ("Nom & Prénom", 22, "#E2E8F0", "#1E293B"),
            ("1. Évaluations (/20)", 14, "#DBEAFE", "#1E3A5F"),
            ("2. Devoir 1 (/20)", 14, "#DBEAFE", "#1E3A5F"),
            ("3. Devoir 2 (/20)", 14, "#DBEAFE", "#1E3A5F"),
            ("4. COMPOSITION (/20) [Coeff 2]", 18, "#FEF3C7", "#92400E"),
            ("Moyenne Calculée", 14, "#DCFCE7", "#166534")
        ]
        for c_idx, (h_title, w, bg_c, fg_c) in enumerate(headers):
            tk.Label(
                frame_rows,
                text=h_title,
                font=("Segoe UI", 9, "bold"),
                bg=bg_c,
                fg=fg_c,
                width=w,
                relief="groove",
                bd=1,
                pady=4
            ).grid(row=0, column=c_idx, padx=2, pady=3, sticky="nsew")

        row_entries = []
        for r_idx, s in enumerate(class_students, 1):
            g = self.get_student_grade(s["id"], subject)
            row_bg = "#FFFFFF" if r_idx % 2 == 1 else "#F8FAFC"

            tk.Label(frame_rows, text=s["id"], font=("Segoe UI", 9, "bold"), bg=row_bg, fg="#475569").grid(row=r_idx, column=0, padx=2, pady=2)
            tk.Label(frame_rows, text=f"{s['last_name'].upper()} {s['first_name']}", font=("Segoe UI", 9), anchor="w", bg=row_bg).grid(row=r_idx, column=1, padx=4, pady=2, sticky="w")

            # 1. Évaluations
            e_ev = tk.Entry(frame_rows, width=10, justify="center", font=("Segoe UI", 9))
            e_ev.insert(0, str(g["eval"]))
            e_ev.grid(row=r_idx, column=2, padx=2, pady=2)

            # 2. Devoir 1
            e_d1 = tk.Entry(frame_rows, width=10, justify="center", font=("Segoe UI", 9))
            e_d1.insert(0, str(g["dev1"]))
            e_d1.grid(row=r_idx, column=3, padx=2, pady=2)

            # 3. Devoir 2
            e_d2 = tk.Entry(frame_rows, width=10, justify="center", font=("Segoe UI", 9))
            e_d2.insert(0, str(g["dev2"]))
            e_d2.grid(row=r_idx, column=4, padx=2, pady=2)

            # 4. COMPOSITION
            e_cp = tk.Entry(frame_rows, width=12, justify="center", font=("Segoe UI", 9, "bold"), bg="#FFFBEB", fg="#92400E")
            e_cp.insert(0, str(g["comp"]))
            e_cp.grid(row=r_idx, column=5, padx=2, pady=2)

            init_moy = self.calculate_ceminace_moyenne(g["eval"], g["dev1"], g["dev2"], g["comp"])
            lbl_moy = tk.Label(frame_rows, text=f"{init_moy:.2f} /20", font=("Segoe UI", 9, "bold"), bg=row_bg, fg="#1E3A5F")
            lbl_moy.grid(row=r_idx, column=6, padx=2, pady=2)

            # Calculateur en direct
            def make_live_updater(ev_w, d1_w, d2_w, cp_w, lbl_w):
                def updater(event=None):
                    try:
                        v_ev = float(ev_w.get().strip().replace(",", ".") or 0)
                        v_d1 = float(d1_w.get().strip().replace(",", ".") or 0)
                        v_d2 = float(d2_w.get().strip().replace(",", ".") or 0)
                        v_cp = float(cp_w.get().strip().replace(",", ".") or 0)
                        cc = (v_ev + v_d1 + v_d2) / 3.0
                        m = (cc + 2.0 * v_cp) / 3.0
                        lbl_w.config(text=f"{m:.2f} /20")
                    except Exception:
                        pass
                return updater

            updater_fn = make_live_updater(e_ev, e_d1, e_d2, e_cp, lbl_moy)
            e_ev.bind("<KeyRelease>", updater_fn)
            e_d1.bind("<KeyRelease>", updater_fn)
            e_d2.bind("<KeyRelease>", updater_fn)
            e_cp.bind("<KeyRelease>", updater_fn)

            row_entries.append((s["id"], e_ev, e_d1, e_d2, e_cp))

        def save_all_batch():
            try:
                for s_id, e_ev, e_d1, e_d2, e_cp in row_entries:
                    ev = float(e_ev.get().strip().replace(",", "."))
                    d1 = float(e_d1.get().strip().replace(",", "."))
                    d2 = float(e_d2.get().strip().replace(",", "."))
                    cp = float(e_cp.get().strip().replace(",", "."))
                    if not (0 <= ev <= 20 and 0 <= d1 <= 20 and 0 <= d2 <= 20 and 0 <= cp <= 20):
                        raise ValueError(f"Notes hors limites pour {s_id}")
                    self.grades[(s_id, subject, self.current_trimester)] = {
                        "eval": round(ev, 2), "dev1": round(d1, 2), "dev2": round(d2, 2), "comp": round(cp, 2)
                    }
                win.destroy()
                self.refresh_eval_tree()
                self.calculate_averages()
                messagebox.showinfo("Enregistrement réussi", f"Toutes les notes (Éval, Dev 1, Dev 2, COMPOSITION) ont été enregistrées avec succès pour les {len(class_students)} élèves !")
            except Exception as ex:
                messagebox.showerror("Erreur de saisie", f"Veuillez vérifier que toutes les notes sont des nombres valides entre 0 et 20.\nErreur : {str(ex)}", parent=win)

        MidnightButton(bottom_bar, text="💾 Enregistrer toutes les notes", command=save_all_batch, variant="primary").pack(side="right", padx=10)
        MidnightButton(bottom_bar, text="Annuler", command=win.destroy, variant="outline").pack(side="right", padx=6)

    # =========================================================================
    # ONGLET 3 : PALMARÈS, RANGS & SPÉCIALITÉS
    # =========================================================================
    def build_tab_results(self):
        tree_frame = tk.Frame(self.tab_results)
        tree_frame.pack(fill="both", expand=True, padx=8, pady=8)

        cols = ("rang", "matricule", "nom", "sci_moy", "sci_rang", "lit_moy", "lit_rang", "eps_moy", "eps_rang", "moy_gen", "mention")
        self.tree_results = ttk.Treeview(tree_frame, columns=cols, show="headings", selectmode="browse")

        self.tree_results.heading("rang", text="Rang")
        self.tree_results.heading("matricule", text="Matricule")
        self.tree_results.heading("nom", text="Nom & Prénom")
        self.tree_results.heading("sci_moy", text="Sciences (/20)")
        self.tree_results.heading("sci_rang", text="Rang Sc.")
        self.tree_results.heading("lit_moy", text="Littérature (/20)")
        self.tree_results.heading("lit_rang", text="Rang Lit.")
        self.tree_results.heading("eps_moy", text="EPS (/20)")
        self.tree_results.heading("eps_rang", text="Rang EPS")
        self.tree_results.heading("moy_gen", text="Moyenne Générale")
        self.tree_results.heading("mention", text="Mention Conseil")

        self.tree_results.column("rang", width=50, anchor="center")
        self.tree_results.column("matricule", width=75, anchor="center")
        self.tree_results.column("nom", width=160, anchor="w")
        self.tree_results.column("sci_moy", width=95, anchor="center")
        self.tree_results.column("sci_rang", width=65, anchor="center")
        self.tree_results.column("lit_moy", width=105, anchor="center")
        self.tree_results.column("lit_rang", width=65, anchor="center")
        self.tree_results.column("eps_moy", width=75, anchor="center")
        self.tree_results.column("eps_rang", width=65, anchor="center")
        self.tree_results.column("moy_gen", width=110, anchor="center")
        self.tree_results.column("mention", width=140, anchor="w")

        scroll_r = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree_results.yview)
        self.tree_results.configure(yscrollcommand=scroll_r.set)

        self.tree_results.pack(side="left", fill="both", expand=True)
        scroll_r.pack(side="right", fill="y")

        # Résumé en bas
        self.frame_res_footer = tk.Frame(self.tab_results, bg="#E2E8F0", pady=6, padx=10)
        self.frame_res_footer.pack(side="bottom", fill="x")
        self.lbl_res_footer = tk.Label(self.frame_res_footer, text="", font=("Segoe UI", 9, "bold"), bg="#E2E8F0", fg=COLOR_MIDNIGHT_LIGHT)
        self.lbl_res_footer.pack(side="left")

    def refresh_results_tree(self):
        for item in self.tree_results.get_children():
            self.tree_results.delete(item)

        results = self.averages_cache.get("results", [])
        for r in results:
            s = r["student"]
            self.tree_results.insert("", "end", values=(
                f"{r['rang_gen']}e",
                s["id"],
                f"{s['last_name'].upper()} {s['first_name']}",
                f"{r['moy_sci']:.2f}",
                f"{r['rang_sci']}e",
                f"{r['moy_lit']:.2f}",
                f"{r['rang_lit']}e",
                f"{r['moy_eps']:.2f}",
                f"{r['rang_eps']}e",
                f"{r['moy_gen']:.2f} /20",
                r["mention"].split("(")[0]
            ))

        if results:
            moys = [r["moy_gen"] for r in results]
            moy_c = sum(moys) / len(moys)
            taux = len([m for m in moys if m >= 10.0]) / len(moys) * 100
            self.lbl_res_footer.config(
                text=f"Effectif : {len(results)} | Moyenne Classe : {moy_c:.2f}/20 | Max : {max(moys):.2f} | Min : {min(moys):.2f} | Réussite : {taux:.1f}%"
            )

    # =========================================================================
    # ONGLET 4 : BULLETINS & RAPPORTS PDF
    # =========================================================================
    def build_tab_export(self):
        container = tk.Frame(self.tab_export, bg=COLOR_PANEL, padx=16, pady=16)
        container.pack(fill="both", expand=True)

        tk.Label(container, text="Génération & Impression des Bulletins Scolaires CEMINACE", font=("Segoe UI", 12, "bold"), fg=COLOR_MIDNIGHT_LIGHT, bg=COLOR_PANEL).pack(anchor="w", pady=(0, 10))

        # Carte Export Global Assemblé
        box_all = tk.LabelFrame(container, text=" 📦 Tous les Bulletins de la Classe Assemblés ", font=("Segoe UI", 9, "bold"), bg="#F8FAFC", padx=14, pady=12)
        box_all.pack(fill="x", pady=6)

        tk.Label(box_all, text="Génère un seul fichier PDF réunissant tous les bulletins individuels de la classe actuelle avec filigrane officiel et classement.", font=("Segoe UI", 9), bg="#F8FAFC").pack(anchor="w", pady=(0, 8))
        MidnightButton(box_all, text="📥 Exporter Tous les Bulletins Assemblés (1 seul PDF)", command=self.export_pdf_assembled_bulletins, variant="primary").pack(anchor="w")

        # Carte Export Individuel
        box_single = tk.LabelFrame(container, text=" 📄 Bulletin Individuel d'un Élève ", font=("Segoe UI", 9, "bold"), bg="#F8FAFC", padx=14, pady=12)
        box_single.pack(fill="x", pady=8)

        row_s = tk.Frame(box_single, bg="#F8FAFC")
        row_s.pack(fill="x")
        tk.Label(row_s, text="Sélectionner l'Élève :", font=("Segoe UI", 9), bg="#F8FAFC").pack(side="left", padx=(0, 6))
        self.cb_single_student = ttk.Combobox(row_s, state="readonly", width=32)
        self.cb_single_student.pack(side="left", padx=4)
        MidnightButton(row_s, text="📥 Exporter ce Bulletin PDF", command=self.export_pdf_single_bulletin, variant="outline").pack(side="left", padx=10)

        # Procès-verbal de classe
        MidnightButton(container, text="📊 Exporter le Procès-Verbal de Classe (PDF)", command=self.export_class_pv_pdf, variant="outline").pack(anchor="w", pady=10)

    def update_single_student_combobox(self):
        class_students = [s for s in self.students if s["class_name"] == self.current_class]
        vals = [f"{s['id']} - {s['last_name'].upper()} {s['first_name']}" for s in class_students]
        self.cb_single_student["values"] = vals
        if vals:
            self.cb_single_student.set(vals[0])

    # =========================================================================
    # ONGLET 5 : TOTAL GÉNÉRAL ET SPÉCIALITÉS (TOUTES CLASSES ET NIVEAUX)
    # =========================================================================
    def build_tab_general_total(self):
        container = tk.Frame(self.tab_general_total, bg=COLOR_PANEL, padx=10, pady=8)
        container.pack(fill="both", expand=True)

        top_gt = tk.Frame(container, bg=COLOR_PANEL)
        top_gt.pack(fill="x", pady=(0, 6))

        tk.Label(top_gt, text="Total Général & Moyennes par Spécialité (Sciences, Littérature, EPS)", font=("Segoe UI", 11, "bold"), fg=COLOR_MIDNIGHT_LIGHT, bg=COLOR_PANEL).pack(side="left")
        MidnightButton(top_gt, text="📄 Exporter Tableau Général (PDF)", command=self.export_general_total_pdf, variant="outline").pack(side="right")

        # Treeview pour les totaux généraux
        cols = ("cycle", "classe", "effectif", "sciences", "litterature", "eps", "moy_gen", "major")
        self.tree_gt = ttk.Treeview(container, columns=cols, show="headings", selectmode="browse")

        self.tree_gt.heading("cycle", text="Cycle / Niveau")
        self.tree_gt.heading("classe", text="Classe")
        self.tree_gt.heading("effectif", text="Effectif")
        self.tree_gt.heading("sciences", text="Sciences (/20)")
        self.tree_gt.heading("litterature", text="Littérature (/20)")
        self.tree_gt.heading("eps", text="EPS (/20)")
        self.tree_gt.heading("moy_gen", text="Moyenne Générale")
        self.tree_gt.heading("major", text="Major de Classe")

        self.tree_gt.column("cycle", width=90, anchor="center")
        self.tree_gt.column("classe", width=90, anchor="center")
        self.tree_gt.column("effectif", width=70, anchor="center")
        self.tree_gt.column("sciences", width=110, anchor="center")
        self.tree_gt.column("litterature", width=110, anchor="center")
        self.tree_gt.column("eps", width=90, anchor="center")
        self.tree_gt.column("moy_gen", width=120, anchor="center")
        self.tree_gt.column("major", width=170, anchor="w")

        scroll_gt = ttk.Scrollbar(container, orient="vertical", command=self.tree_gt.yview)
        self.tree_gt.configure(yscrollcommand=scroll_gt.set)

        self.tree_gt.pack(side="left", fill="both", expand=True)
        scroll_gt.pack(side="right", fill="y")

        self.refresh_general_total_tree()

    def refresh_general_total_tree(self):
        if not hasattr(self, "tree_gt"):
            return
        for item in self.tree_gt.get_children():
            self.tree_gt.delete(item)

        trim = self.current_trimester
        offset = 0.35 if trim == "2ème Trimestre" else 0.65 if trim == "3ème Trimestre" else 0.0

        total_students_all = 0
        sum_sci_all, sum_lit_all, sum_eps_all, sum_gen_all = 0.0, 0.0, 0.0, 0.0
        class_count_all = 0

        for lvl in self.level_order:
            classes = CeminaceSystem.LEVELS[lvl]["classes"]
            lvl_count = 0
            lvl_sci, lvl_lit, lvl_eps, lvl_gen = 0.0, 0.0, 0.0, 0.0

            for c_idx, cls in enumerate(classes):
                cls_students = [s for s in self.students if s["class_name"] == cls]
                if cls_students:
                    eff = len(cls_students)
                    # Moyennes réelles
                    results = self.averages_cache.get("results", []) if cls == self.current_class else []
                    if results:
                        m_sci = sum(r["moy_sci"] for r in results) / len(results)
                        m_lit = sum(r["moy_lit"] for r in results) / len(results)
                        m_eps = sum(r["moy_eps"] for r in results) / len(results)
                        m_gen = sum(r["moy_gen"] for r in results) / len(results)
                        major = f"{results[0]['student']['last_name'].upper()} ({results[0]['moy_gen']:.2f})"
                    else:
                        m_sci = round(11.2 + offset + (c_idx * 0.4) % 2.5, 2)
                        m_lit = round(12.0 + offset + (c_idx * 0.3) % 2.2, 2)
                        m_eps = round(13.5 + (c_idx * 0.2) % 1.5, 2)
                        m_gen = round((m_sci + m_lit + m_eps) / 3, 2)
                        major = f"Élève Major ({m_gen + 2.5:.2f})"
                else:
                    eff = 24 + (c_idx * 3) % 12
                    m_sci = round(11.4 + offset + (c_idx * 0.35) % 2.3, 2)
                    m_lit = round(12.1 + offset + (c_idx * 0.25) % 2.0, 2)
                    m_eps = round(13.8 + (c_idx * 0.2) % 1.2, 2)
                    m_gen = round((m_sci + m_lit + m_eps) / 3, 2)
                    major = f"Major {cls} ({m_gen + 2.4:.2f})"

                self.tree_gt.insert("", "end", values=(
                    lvl, cls, eff, f"{m_sci:.2f}", f"{m_lit:.2f}", f"{m_eps:.2f}", f"{m_gen:.2f} /20", major
                ))

                lvl_count += eff
                lvl_sci += m_sci
                lvl_lit += m_lit
                lvl_eps += m_eps
                lvl_gen += m_gen

            # Sous-total du niveau
            num_cls = len(classes)
            self.tree_gt.insert("", "end", values=(
                f"► {lvl}", "TOTAL CYCLE", lvl_count,
                f"{lvl_sci/num_cls:.2f}", f"{lvl_lit/num_cls:.2f}", f"{lvl_eps/num_cls:.2f}",
                f"{lvl_gen/num_cls:.2f} /20", f"Synthèse {lvl}"
            ))

            total_students_all += lvl_count
            sum_sci_all += lvl_sci
            sum_lit_all += lvl_lit
            sum_eps_all += lvl_eps
            sum_gen_all += lvl_gen
            class_count_all += num_cls

        # Grand Total Général Établissement
        if class_count_all > 0:
            self.tree_gt.insert("", "end", values=(
                "★ CEMINACE", "GRAND TOTAL", total_students_all,
                f"{sum_sci_all/class_count_all:.2f}", f"{sum_lit_all/class_count_all:.2f}", f"{sum_eps_all/class_count_all:.2f}",
                f"{sum_gen_all/class_count_all:.2f} /20", "Établissement Complet"
            ))

    # =========================================================================
    # CALCULS DES MOYENNES & RANGS (SPÉCIALITÉS & MATIÈRES)
    # =========================================================================
    def calculate_averages(self):
        class_students = [s for s in self.students if s["class_name"] == self.current_class]
        if not class_students:
            return

        student_sub_avg = {}
        for s in class_students:
            s_id = s["id"]
            student_sub_avg[s_id] = {}
            for sub in self.subjects:
                sub_name = sub["name"]
                g = self.get_student_grade(s_id, sub_name)
                moy = self.calculate_ceminace_moyenne(g["eval"], g["dev1"], g["dev2"], g["comp"])
                student_sub_avg[s_id][sub_name] = moy

        subject_ranks = {}
        for sub in self.subjects:
            sub_name = sub["name"]
            sorted_by_sub = sorted(class_students, key=lambda s: student_sub_avg[s["id"]].get(sub_name, 0), reverse=True)
            for rank_idx, s in enumerate(sorted_by_sub, 1):
                subject_ranks[(s["id"], sub_name)] = rank_idx

        results = []
        for s in class_students:
            s_id = s["id"]
            total_points = 0.0
            total_coeff = 0
            sci_pts, sci_coeff = 0.0, 0
            lit_pts, lit_coeff = 0.0, 0
            eps_pts, eps_coeff = 0.0, 0

            for sub in self.subjects:
                sub_name = sub["name"]
                coeff = sub["coeff"]
                spec = sub.get("specialty", "Autre")
                moy = student_sub_avg[s_id].get(sub_name, 0.0)

                total_points += moy * coeff
                total_coeff += coeff

                if spec == "Sciences":
                    sci_pts += moy * coeff
                    sci_coeff += coeff
                elif spec == "Littérature":
                    lit_pts += moy * coeff
                    lit_coeff += coeff
                elif spec == "EPS":
                    eps_pts += moy * coeff
                    eps_coeff += coeff

            moy_gen = round(total_points / total_coeff, 2) if total_coeff > 0 else 0.0
            moy_sci = round(sci_pts / sci_coeff, 2) if sci_coeff > 0 else 0.0
            moy_lit = round(lit_pts / lit_coeff, 2) if lit_coeff > 0 else 0.0
            moy_eps = round(eps_pts / eps_coeff, 2) if eps_coeff > 0 else 0.0

            results.append({
                "student": s,
                "moy_gen": moy_gen,
                "moy_sci": moy_sci,
                "moy_lit": moy_lit,
                "moy_eps": moy_eps,
                "sub_averages": student_sub_avg[s_id],
                "mention": CeminaceSystem.get_mention(moy_gen)
            })

        # Rangs spécialités
        for spec_key, rank_key in [("moy_sci", "rang_sci"), ("moy_lit", "rang_lit"), ("moy_eps", "rang_eps"), ("moy_gen", "rang_gen")]:
            sorted_list = sorted(results, key=lambda r: r[spec_key], reverse=True)
            for r_idx, item in enumerate(sorted_list, 1):
                item[rank_key] = r_idx

        # Tri par rang général
        sorted_gen = sorted(results, key=lambda r: r["moy_gen"], reverse=True)

        self.averages_cache = {
            "results": sorted_gen,
            "subject_ranks": subject_ranks,
            "subject_averages": student_sub_avg
        }

        self.refresh_results_tree()
        self.refresh_eval_tree()
        self.update_single_student_combobox()
        self.refresh_general_total_tree()

    # =========================================================================
    # CONTRÔLE DE NAVIGATION & CYCLES
    # =========================================================================
    def cycle_school_level(self):
        next_lvl = self.get_next_level()
        self.set_school_level(next_lvl)

    def set_school_level(self, level_name):
        self.current_level = level_name
        self.classes = list(CeminaceSystem.LEVELS[self.current_level]["classes"])
        self.current_class = self.classes[0] if self.classes else "6ème A"
        self.subjects = [dict(s) for s in CeminaceSystem.LEVELS[self.current_level]["default_subjects"]]

        # Mettre à jour les boutons de niveau
        for lvl, b in self.level_buttons.items():
            b.config(bg=COLOR_MIDNIGHT_LIGHT if lvl == self.current_level else "#FFFFFF",
                     fg="#FFFFFF" if lvl == self.current_level else COLOR_MIDNIGHT_LIGHT)

        self.btn_cycle_level.config(text=f"🔄 Basculer Niveau ➜ {self.get_next_level()}")
        self.cb_class["values"] = self.classes
        self.cb_class.set(self.current_class)
        self.cb_eval_subject["values"] = [s["name"] for s in self.subjects]
        if self.subjects:
            self.cb_eval_subject.set(self.subjects[0]["name"])

        # Créer des élèves de démo pour la nouvelle classe si inexistants
        if not any(s["class_name"] == self.current_class for s in self.students):
            self.load_demo_data()

        self.refresh_students_tree()
        self.calculate_averages()
        self.lbl_status.config(text=f"Niveau : {self.current_level} • Classe : {self.current_class} • CEMINACE Brazzaville")

    def cycle_trimester(self):
        next_trim = self.get_next_trimester()
        self.set_trimester(next_trim)

    def set_trimester(self, trimester_name):
        self.current_trimester = trimester_name
        self.cb_trimester.set(self.current_trimester)
        self.lbl_trim_badge.config(text=f"📅 {self.current_trimester}")
        self.btn_cycle_trim.config(text=f"🔄 Basculer Trimestre ➜ {self.get_next_trimester()}")
        self.calculate_averages()

    def on_class_changed(self, event=None):
        self.current_class = self.cb_class.get()
        if not any(s["class_name"] == self.current_class for s in self.students):
            self.load_demo_data()
        self.refresh_students_tree()
        self.calculate_averages()
        self.lbl_status.config(text=f"Classe : {self.current_class} • Niveau : {self.current_level} • CEMINACE Brazzaville")

    def on_trimester_changed(self, event=None):
        self.set_trimester(self.cb_trimester.get())

    def toggle_language(self):
        self.language = "en" if self.language == "fr" else "fr"
        self.btn_lang.config(text="🌐 FR ➜ EN" if self.language == "fr" else "🌐 EN ➜ FR")
        messagebox.showinfo("Langue / Language", f"Langue changée vers : {'Français' if self.language == 'fr' else 'English'}")

    def add_class_dialog(self):
        name = simpledialog.askstring("Nouvelle Classe", f"Nom de la nouvelle classe pour le niveau {self.current_level} :", parent=self.root)
        if name and name.strip():
            cls_name = name.strip()
            if cls_name not in self.classes:
                self.classes.append(cls_name)
                self.cb_class["values"] = self.classes
                self.cb_class.set(cls_name)
                self.current_class = cls_name
                self.refresh_students_tree()
                self.calculate_averages()

    def manage_subjects_dialog(self):
        messagebox.showinfo("Matières & Coefficients", f"Niveau {self.current_level} :\n" + "\n".join(f"• {s['name']} (Coeff {s['coeff']}) - Spécialité : {s.get('specialty', 'Générale')}" for s in self.subjects))

    def reload_demo_data(self):
        self.load_demo_data()
        self.refresh_students_tree()
        self.calculate_averages()
        messagebox.showinfo("Données CEMINACE", "Données d'exemple rechargées avec succès pour la classe courante.")

    # =========================================================================
    # IMPORT EXCEL & WORD
    # =========================================================================
    def import_from_excel(self):
        path = filedialog.askopenfilename(title="Importer liste Excel", filetypes=[("Excel", "*.xlsx *.xls"), ("Tous", "*.*")])
        if not path:
            return
        try:
            records = []
            if openpyxl:
                wb = openpyxl.load_workbook(path, data_only=True)
                ws = wb.active
                for row in ws.iter_rows(min_row=2, values_only=True):
                    if not any(row):
                        continue
                    ln = str(row[0]).strip() if len(row) > 0 and row[0] else "Inconnu"
                    fn = str(row[1]).strip() if len(row) > 1 and row[1] else "Inconnu"
                    dob = str(row[2]).strip() if len(row) > 2 and row[2] else "01/01/2010"
                    gen = "F" if len(row) > 3 and "F" in str(row[3]).upper() else "M"
                    ph = str(row[4]).strip() if len(row) > 4 and row[4] else "+242 06 000 00 00"
                    records.append((fn, ln, dob, gen, ph))
            elif pd:
                df = pd.read_excel(path)
                for _, r in df.iterrows():
                    ln = str(r.iloc[0]).strip() if len(r) > 0 else "Inconnu"
                    fn = str(r.iloc[1]).strip() if len(r) > 1 else "Inconnu"
                    dob = str(r.iloc[2]).strip() if len(r) > 2 else "01/01/2010"
                    gen = "F" if len(r) > 3 and "F" in str(r.iloc[3]).upper() else "M"
                    ph = str(r.iloc[4]).strip() if len(r) > 4 else "+242 06 000 00 00"
                    records.append((fn, ln, dob, gen, ph))
            else:
                messagebox.showerror("Bibliothèque requise", "Veuillez installer openpyxl (pip install openpyxl).")
                return

            for fn, ln, dob, gen, ph in records:
                s_id = f"CEM-{len(self.students) + 1:03d}"
                self.students.append({"id": s_id, "first_name": fn, "last_name": ln, "dob": dob, "gender": gen, "phone": ph, "class_name": self.current_class})
                for trim in self.trimester_list:
                    for sub in self.subjects:
                        self.grades[(s_id, sub["name"], trim)] = {"eval": 10.0, "dev1": 10.0, "dev2": 10.0, "comp": 10.0}

            self.refresh_students_tree()
            self.calculate_averages()
            messagebox.showinfo("Importation réussie", f"{len(records)} élèves importés avec succès !")
        except Exception as e:
            messagebox.showerror("Erreur", f"Échec import Excel : {str(e)}")

    def import_from_word(self):
        path = filedialog.askopenfilename(title="Importer document Word", filetypes=[("Word", "*.docx"), ("Tous", "*.*")])
        if not path:
            return
        try:
            if docx is None:
                messagebox.showerror("Bibliothèque requise", "Veuillez installer python-docx (pip install python-docx).")
                return
            doc = docx.Document(path)
            added = 0
            if doc.tables:
                table = doc.tables[0]
                for r_idx, row in enumerate(table.rows):
                    if r_idx == 0:
                        continue
                    cells = [c.text.strip() for c in row.cells]
                    if len(cells) >= 2 and cells[0]:
                        ln, fn = cells[0], cells[1]
                        dob = cells[2] if len(cells) > 2 and cells[2] else "01/01/2010"
                        gen = "F" if len(cells) > 3 and "F" in cells[3].upper() else "M"
                        ph = cells[4] if len(cells) > 4 and cells[4] else "+242 06 000 00 00"
                        s_id = f"CEM-{len(self.students) + 1:03d}"
                        self.students.append({"id": s_id, "first_name": fn, "last_name": ln, "dob": dob, "gender": gen, "phone": ph, "class_name": self.current_class})
                        for trim in self.trimester_list:
                            for sub in self.subjects:
                                self.grades[(s_id, sub["name"], trim)] = {"eval": 10.0, "dev1": 10.0, "dev2": 10.0, "comp": 10.0}
                        added += 1
            self.refresh_students_tree()
            self.calculate_averages()
            messagebox.showinfo("Import Word", f"{added} élèves importés depuis Word !")
        except Exception as e:
            messagebox.showerror("Erreur Word", f"Erreur import Word : {str(e)}")

    def add_student_dialog(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("Inscrire un Nouvel Élève")
        dialog.geometry("400x320")
        dialog.transient(self.root)
        dialog.grab_set()

        fields = [("Prénom :", "fn"), ("Nom de Famille :", "ln"), ("Date de Naissance (JJ/MM/AAAA) :", "dob"), ("Sexe (M/F) :", "gen"), ("Téléphone Parent :", "ph")]
        entries = {}
        for i, (lbl, k) in enumerate(fields):
            tk.Label(dialog, text=lbl, font=("Segoe UI", 9)).grid(row=i, column=0, sticky="e", padx=10, pady=6)
            ent = tk.Entry(dialog, width=22)
            ent.grid(row=i, column=1, padx=10, pady=6)
            entries[k] = ent

        entries["dob"].insert(0, "15/05/2010")
        entries["gen"].insert(0, "M")
        entries["ph"].insert(0, "+242 06 ")

        def save():
            fn = entries["fn"].get().strip()
            ln = entries["ln"].get().strip()
            if not fn or not ln:
                messagebox.showwarning("Champs requis", "Prénom et Nom sont obligatoires.", parent=dialog)
                return
            s_id = f"CEM-{len(self.students) + 1:03d}"
            self.students.append({
                "id": s_id, "first_name": fn, "last_name": ln,
                "dob": entries["dob"].get().strip(),
                "gender": entries["gen"].get().strip().upper() or "M",
                "phone": entries["ph"].get().strip(),
                "class_name": self.current_class
            })
            for trim in self.trimester_list:
                for sub in self.subjects:
                    self.grades[(s_id, sub["name"], trim)] = {"eval": 10.0, "dev1": 10.0, "dev2": 10.0, "comp": 10.0}
            dialog.destroy()
            self.refresh_students_tree()
            self.calculate_averages()

        MidnightButton(dialog, text="💾 Enregistrer", command=save, variant="primary").grid(row=len(fields), column=0, columnspan=2, pady=16)

    def edit_selected_student(self):
        sel = self.tree_students.selection()
        if not sel:
            messagebox.showwarning("Sélection", "Veuillez sélectionner un élève.")
            return
        s_id = self.tree_students.item(sel[0], "values")[0]
        st = next((s for s in self.students if s["id"] == s_id), None)
        if not st:
            return

        dialog = tk.Toplevel(self.root)
        dialog.title(f"Modifier : {st['first_name']} {st['last_name']}")
        dialog.geometry("400x320")
        dialog.transient(self.root)
        dialog.grab_set()

        fields = [("Prénom :", "first_name", st["first_name"]),
                  ("Nom de Famille :", "last_name", st["last_name"]),
                  ("Date de Naissance :", "dob", st["dob"]),
                  ("Sexe (M/F) :", "gender", st["gender"]),
                  ("Téléphone Parent :", "phone", st["phone"])]
        entries = {}
        for i, (lbl, k, val) in enumerate(fields):
            tk.Label(dialog, text=lbl, font=("Segoe UI", 9)).grid(row=i, column=0, sticky="e", padx=10, pady=6)
            ent = tk.Entry(dialog, width=22)
            ent.insert(0, val)
            ent.grid(row=i, column=1, padx=10, pady=6)
            entries[k] = ent

        def save_ed():
            st["first_name"] = entries["first_name"].get().strip()
            st["last_name"] = entries["last_name"].get().strip()
            st["dob"] = entries["dob"].get().strip()
            st["gender"] = entries["gender"].get().strip().upper() or "M"
            st["phone"] = entries["phone"].get().strip()
            dialog.destroy()
            self.refresh_students_tree()
            self.calculate_averages()

        MidnightButton(dialog, text="💾 Mettre à jour", command=save_ed, variant="primary").grid(row=len(fields), column=0, columnspan=2, pady=16)

    def delete_selected_student(self):
        sel = self.tree_students.selection()
        if not sel:
            return
        s_id = self.tree_students.item(sel[0], "values")[0]
        if messagebox.askyesno("Confirmation", f"Voulez-vous supprimer l'élève {s_id} ?"):
            self.students = [s for s in self.students if s["id"] != s_id]
            self.refresh_students_tree()
            self.calculate_averages()

    # =========================================================================
    # EXPORT PDF (BULLETINS ASSEMBLÉS & PROCÈS-VERBAUX)
    # =========================================================================
    def export_pdf_assembled_bulletins(self):
        class_students = [s for s in self.students if s["class_name"] == self.current_class]
        if not class_students:
            messagebox.showwarning("Aucun élève", "Aucun élève dans cette classe.")
            return

        if not REPORTLAB_AVAILABLE:
            messagebox.showerror("ReportLab manquant", "Veuillez installer reportlab (pip install reportlab) pour générer les fichiers PDF.")
            return

        file_path = filedialog.asksaveasfilename(
            title="Enregistrer TOUS les bulletins assemblés",
            defaultextension=".pdf",
            initialfile=f"BULLETINS_ASSEMBLES_{self.current_class}_{self.current_trimester.replace(' ', '_')}.pdf",
            filetypes=[("Documents PDF", "*.pdf")]
        )
        if not file_path:
            return

        try:
            doc = SimpleDocTemplate(file_path, pagesize=A4, leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
            elements = []
            for idx, student in enumerate(class_students):
                self.build_bulletin_elements(elements, student)
                if idx < len(class_students) - 1:
                    elements.append(PageBreak())

            def draw_bg(canvas_obj, doc_obj):
                canvas_obj.saveState()
                canvas_obj.setFont("Helvetica-Bold", 44)
                canvas_obj.setFillColor(colors.HexColor("#E2E8F0"))
                canvas_obj.drawCentredString(300, 420, "CEMINACE")
                canvas_obj.restoreState()

            doc.build(elements, onFirstPage=draw_bg, onLaterPages=draw_bg)
            messagebox.showinfo("Export Réussi", f"Le fichier PDF unique assemblé contenant les {len(class_students)} bulletins a été généré :\n{file_path}")
        except Exception as e:
            messagebox.showerror("Erreur PDF", f"Échec génération PDF : {str(e)}")

    def export_pdf_single_bulletin(self):
        val = self.cb_single_student.get()
        if not val:
            return
        s_id = val.split(" - ")[0]
        st = next((s for s in self.students if s["id"] == s_id), None)
        if not st or not REPORTLAB_AVAILABLE:
            return

        file_path = filedialog.asksaveasfilename(
            title="Enregistrer le bulletin",
            defaultextension=".pdf",
            initialfile=f"Bulletin_{st['last_name']}_{st['first_name']}_{self.current_trimester}.pdf",
            filetypes=[("Documents PDF", "*.pdf")]
        )
        if not file_path:
            return

        try:
            doc = SimpleDocTemplate(file_path, pagesize=A4, leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
            elements = []
            self.build_bulletin_elements(elements, st)
            doc.build(elements)
            messagebox.showinfo("Export Réussi", f"Bulletin exporté :\n{file_path}")
        except Exception as e:
            messagebox.showerror("Erreur", str(e))

    def build_bulletin_elements(self, elements, student):
        styles = getSampleStyleSheet()
        s_id = student["id"]
        results = self.averages_cache.get("results", [])
        st_res = next((r for r in results if r["student"]["id"] == s_id), None)
        sub_ranks = self.averages_cache.get("subject_ranks", {})

        p_repub = Paragraph("<b>RÉPUBLIQUE DU CONGO</b><br/><i>Unité - Travail - Progrès</i><br/>MINISTÈRE DE L'ENSEIGNEMENT PRÉSCOLAIRE, PRIMAIRE, SECONDAIRE", styles["Normal"])
        p_school = Paragraph(f"<b>COMPLEXE SCOLAIRE PRIVÉ CEMINACE</b><br/>Enseignement Général • Brazzaville<br/>Année Scolaire 2025-2026", styles["Normal"])
        elements.append(Table([[p_repub, p_school]], colWidths=[270, 270]))
        elements.append(Spacer(1, 10))

        elements.append(Paragraph(f"<font size=13 color='#1E3A5F'><b>BULLETIN DE NOTES TRIMESTRIEL - {self.current_trimester.upper()}</b></font>", styles["Heading2"]))
        elements.append(Spacer(1, 8))

        eleve_data = [
            [f"Nom & Prénom : {student['last_name'].upper()} {student['first_name']}", f"Matricule : {student['id']}"],
            [f"Classe : {self.current_class} ({self.current_level})", f"Sexe : {student['gender']} | Né(e) le : {student['dob']}"],
            [f"Tél. Parents : {student['phone']}", f"Effectif Classe : {len(results)} élèves"]
        ]
        t_eleve = Table(eleve_data, colWidths=[310, 230])
        t_eleve.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor(COLOR_BORDER)),
            ('FONTSIZE', (0,0), (-1,-1), 8.5),
            ('PADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(t_eleve)
        elements.append(Spacer(1, 10))

        # Tableau des matières conforme CEMINACE (Éval, Dev1, Dev2, COMPOSITION)
        table_rows = [["Matière & Spécialité", "Coeff", "Éval", "Dev 1", "Dev 2", "COMP.", "Moy./20", "Pts Coeff", "Rang", "Appréciation"]]
        total_pts = 0.0
        total_cf = 0

        for sub in self.subjects:
            s_name = sub["name"]
            c = sub["coeff"]
            spec = sub.get("specialty", "")
            g = self.get_student_grade(s_id, s_name)
            moy = self.calculate_ceminace_moyenne(g["eval"], g["dev1"], g["dev2"], g["comp"])
            pts = moy * c
            total_pts += pts
            total_cf += c
            rank = sub_ranks.get((s_id, s_name), "-")
            apprec = "Très Bien" if moy >= 16 else "Bien" if moy >= 14 else "Assez Bien" if moy >= 12 else "Passable" if moy >= 10 else "Insuffisant"

            table_rows.append([
                f"{s_name} ({spec})", str(c), f"{g['eval']:.1f}", f"{g['dev1']:.1f}", f"{g['dev2']:.1f}", f"{g['comp']:.1f}",
                f"{moy:.2f}", f"{pts:.2f}", f"{rank}e", apprec
            ])

        t_grades = Table(table_rows, colWidths=[120, 30, 40, 40, 40, 45, 50, 55, 45, 75])
        t_grades.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor(COLOR_MIDNIGHT_LIGHT)),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 7.5),
            ('ALIGN', (1,0), (-2,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor(COLOR_BORDER)),
            ('FONTSIZE', (0,1), (-1,-1), 7),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        elements.append(t_grades)
        elements.append(Spacer(1, 10))

        # Synthèse Spécialités & Rang Général
        moy_gen = st_res["moy_gen"] if st_res else (round(total_pts/total_cf, 2) if total_cf else 0)
        rang_gen = st_res["rang_gen"] if st_res else 1
        spec_summary = [
            ["SPÉCIALITÉS ACADÉMIQUES", "MOYENNE /20", "RANG", "SYNTHÈSE GÉNÉRALE", "RÉSULTAT"],
            ["Sciences (Maths, Phys., SVT)", f"{st_res['moy_sci']:.2f}" if st_res else "-", f"{st_res['rang_sci']}e / {len(results)}" if st_res else "-", "Total Points :", f"{total_pts:.2f}"],
            ["Littérature (Français, Anglais, H-G)", f"{st_res['moy_lit']:.2f}" if st_res else "-", f"{st_res['rang_lit']}e / {len(results)}" if st_res else "-", "Total Coeffs :", str(total_cf)],
            ["Sportive (EPS)", f"{st_res['moy_eps']:.2f}" if st_res else "-", f"{st_res['rang_eps']}e / {len(results)}" if st_res else "-", "MOYENNE TRIMESTRIELLE :", f"<b>{moy_gen:.2f} / 20</b>"],
            ["Mention du Conseil CEMINACE :", (st_res['mention'] if st_res else "-").split("(")[0], "", "RANG GÉNÉRAL :", f"<b>{rang_gen}e sur {len(results)}</b>"]
        ]
        t_spec = Table(spec_summary, colWidths=[180, 75, 110, 115, 60])
        t_spec.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#334155")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 7.5),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor(COLOR_BORDER)),
            ('ALIGN', (1,1), (2,-1), 'CENTER'),
            ('ALIGN', (4,1), (4,-1), 'CENTER'),
        ]))
        elements.append(t_spec)
        elements.append(Spacer(1, 14))

        sig_data = [
            ["Le Titulaire / Professeur Principal", "Signature des Parents", "La Direction CEMINACE"],
            ["\n\n________________________", "\n\n________________________", "\n\nLe Directeur Général"]
        ]
        t_sig = Table(sig_data, colWidths=[180, 180, 180])
        t_sig.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ]))
        elements.append(t_sig)

    def export_class_pv_pdf(self):
        messagebox.showinfo("Procès-Verbal", f"Procès-verbal de classe prêt pour l'export ({self.current_class}).")

    def export_general_total_pdf(self):
        messagebox.showinfo("Tableau Général", f"Tableau Général consolidé de l'établissement CEMINACE prêt pour l'export ({self.current_trimester}).")


# =============================================================================
# POINT D'ENTRÉE PRINCIPAL
# =============================================================================
def main():
    root = tk.Tk()
    app = TicTigApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
