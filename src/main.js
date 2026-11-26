import './style.css';
import { supabase } from './supabaseClient.js';

const $ = (id) => document.getElementById(id);

let students = [];
let courses = [];
let departments = [];
let accessReady = false;
let sessionVersion = 0;

function showMessage(text) {
  $('message').textContent = text;
}

function clearForm() {
  $('student-form').reset();
  $('student-id').value = '';
}

function showApp(session) {
  accessReady = !!session;

  $('app').hidden = !accessReady;
  $('login').hidden = accessReady;

  $('signed-in').textContent = session
    ? `Signed in as ${session.user.email}`
    : '';

  $('auth-message').textContent = session
    ? ''
    : 'Sign in to continue.';
}

function renderDepartments() {
  $('department-list').replaceChildren();

  if (!departments.length) {
    $('department-list').textContent = 'No departments found.';
    return;
  }

  for (const department of departments) {
    const li = document.createElement('li');
    const name = document.createElement('span');

    name.textContent =
      department.department_name ?? 'Unnamed department';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';

    remove.onclick = async () => {
      if (!confirm(`Delete ${name.textContent}?`)) return;

      const { data, error } = await supabase
        .from('department')
        .delete()
        .eq('id', department.id)
        .select('id');

      if (error) {
        showMessage(error.message);
        return;
      }

      if (!data?.length) {
        showMessage('Department was not deleted.');
        return;
      }

      await load();
      showMessage('Department deleted successfully.');
    };

    li.append(name, remove);
    $('department-list').append(li);
  }
}

function fillCourseOptions() {
  const selectedCourse = $('course').value;
  const selectedReportCourse = $('report-course').value;

  $('course').replaceChildren(
    new Option('Choose a course', '')
  );

  $('report-course').replaceChildren(
    new Option('Choose a course', '')
  );

  for (const course of courses) {
    const label =
      `${course.course_code} - ${course.course_name}`;

    $('course').add(
      new Option(label, course.course_id)
    );

    $('report-course').add(
      new Option(label, course.course_id)
    );
  }

  $('course').value = selectedCourse;
  $('report-course').value = selectedReportCourse;
}

function renderStudents() {
  const term = $('search').value.trim().toLowerCase();

  $('student-list').replaceChildren();

  const visible = students.filter((student) => {
    const text =
      `${student.student_no} ` +
      `${student.first_name} ` +
      `${student.last_name}`;

    return text.toLowerCase().includes(term);
  });

  if (!visible.length) {
    const li = document.createElement('li');
    li.textContent = 'No matching records.';
    $('student-list').append(li);
    return;
  }

  for (const student of visible) {
    const selectedCourse = courses.find(
      (course) =>
        String(course.course_id) ===
        String(student.course_code)
    );

    const li = document.createElement('li');
    const details = document.createElement('span');

    details.textContent =
      `${student.student_no} | ` +
      `${student.first_name} ${student.last_name} | ` +
      `Year ${student.year_level} | ` +
      `${student.email} | ` +
      `${selectedCourse?.course_code ?? student.course} | ` +
      `${selectedCourse?.course_name ?? 'Course not found'}`;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';

    edit.onclick = () => {
      $('student-id').value = student.id;
      $('student-no').value = student.student_no;
      $('first-name').value = student.first_name;
      $('last-name').value = student.last_name;
      $('year').value = student.year_level;
      $('student-email').value = student.email;
      $('course').value = student.course_code ?? '';

      showMessage('Editing student record.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';

    remove.onclick = async () => {
      if (
        !confirm(
          `Delete student ${student.student_no}?`
        )
      ) {
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id)
        .select('id');

      if (error) {
        showMessage(error.message);
        return;
      }

      if (!data?.length) {
        showMessage('Student was not deleted.');
        return;
      }

      await load();
      showMessage('Student deleted successfully.');
    };

    li.append(details, edit, remove);
    $('student-list').append(li);
  }
}

async function load() {
  const version = sessionVersion;

  const results = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .order('last_name'),

    supabase
      .from('course')
      .select('*')
      .order('course_code'),

    supabase
      .from('department')
      .select('*')
      .order('department_name')
  ]);

  if (version !== sessionVersion || !accessReady) {
    return;
  }

  const error = results.find(
    (result) => result.error
  )?.error;

  if (error) {
    showMessage(error.message);
    return;
  }

  students = results[0].data ?? [];
  courses = results[1].data ?? [];
  departments = results[2].data ?? [];

  fillCourseOptions();
  renderStudents();
  renderDepartments();

  showMessage(
    `${students.length} student record(s) loaded.`
  );
}

async function checkSession() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    $('auth-message').textContent = error.message;
    return;
  }

  showApp(data.session);

  if (data.session) {
    sessionVersion++;
    await load();
  }
}

// LOGIN
$('login').onsubmit = async (event) => {
  event.preventDefault();

  $('auth-message').textContent = 'Signing in...';

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });

  if (error) {
    $('auth-message').textContent = error.message;
    return;
  }

  $('password').value = '';

  showApp(data.session);

  sessionVersion++;
  await load();
};

// LOGOUT
$('logout').onclick = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    $('auth-message').textContent = error.message;
    return;
  }

  sessionVersion++;

  students = [];
  courses = [];
  departments = [];

  $('student-list').replaceChildren();
  $('department-list').replaceChildren();

  $('report').textContent = '';

  clearForm();

  showApp(null);
};

// ADD OR EDIT STUDENT
$('student-form').onsubmit = async (event) => {
  event.preventDefault();

  if (!accessReady) {
    showMessage('Please sign in first.');
    return;
  }

  const selectedCourse = courses.find(
    (course) =>
      String(course.course_id) === $('course').value
  );

  if (!selectedCourse) {
    showMessage('Please choose a valid course.');
    return;
  }

  const yearLevel = Number($('year').value);

  if (
    !Number.isInteger(yearLevel) ||
    yearLevel < 1 ||
    yearLevel > 32767
  ) {
    showMessage('Enter a valid year level.');
    return;
  }

  const record = {
    student_no: $('student-no').value.trim(),
    first_name: $('first-name').value.trim(),
    last_name: $('last-name').value.trim(),
    course: selectedCourse.course_code,
    year_level: yearLevel,
    email: $('student-email').value.trim(),
    course_code: selectedCourse.course_id
  };

  if (
    !record.student_no ||
    !record.first_name ||
    !record.last_name ||
    !record.email
  ) {
    showMessage('Please complete all required fields.');
    return;
  }

  const id = $('student-id').value;

  const query = id
    ? supabase
        .from('students')
        .update(record)
        .eq('id', id)
    : supabase
        .from('students')
        .insert(record);

  const { data, error } = await query.select('id');

  if (error) {
    showMessage(error.message);
    return;
  }

  if (!data?.length) {
    showMessage('Student was not saved.');
    return;
  }

  clearForm();

  await load();

  showMessage('Student saved successfully.');
};

// CLEAR FORM
$('clear').onclick = () => {
  clearForm();
  showMessage('Form cleared.');
};

// REFRESH AND SEARCH
$('refresh').onclick = () => load();

$('search').oninput = () => {
  renderStudents();
};

// COURSE REPORT
$('count').onclick = async () => {
  const courseId = $('report-course').value;

  if (!courseId) {
    $('report').textContent = 'Choose a course first.';
    return;
  }

  const selectedCourse = courses.find(
    (course) =>
      String(course.course_id) === courseId
  );

  const { count, error } = await supabase
    .from('students')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('course_code', courseId);

  $('report').textContent = error
    ? error.message
    : `Total students in ${selectedCourse?.course_code}: ${count}`;
};

// ADD DEPARTMENT
$('department-form').onsubmit = async (event) => {
  event.preventDefault();

  const departmentName =
    $('department-name').value.trim();

  if (!departmentName) {
    showMessage('Enter a department name.');
    return;
  }

  const { error } = await supabase
    .from('department')
    .insert({
      department_name: departmentName
    });

  if (error) {
    showMessage(error.message);
    return;
  }

  $('department-form').reset();

  await load();

  showMessage('Department added successfully.');
};

// AUTH STATE CHANGE
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    sessionVersion++;

    students = [];
    courses = [];
    departments = [];

    $('student-list').replaceChildren();
    $('department-list').replaceChildren();

    $('report').textContent = '';

    clearForm();
    showApp(null);
  }
});

// INITIAL SESSION CHECK
checkSession().catch((error) => {
  $('auth-message').textContent = error.message;
});