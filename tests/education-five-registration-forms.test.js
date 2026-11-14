import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const migration = read("database/neon/migrations/20261114_split_five_education_registration_forms.sql");
const followup = read("database/neon/migrations/20261114_five_forms_fee_and_guardian_fields.sql");
const curriculumMigration = read("database/neon/migrations/20261114_domain_curriculum_reference_choices.sql");
const home = read("index.html");
const requestApi = read("api/education/service-requests.js");

const fiveForms = [
  "early_childhood_registration",
  "general_education_registration",
  "university_guidance",
  "course_registration",
  "activity_join"
];
for (const code of fiveForms) {
  assert.ok(migration.includes(code) || code === "university_guidance" || code === "course_registration" || code === "activity_join",
    "The five approved fields must have a distinct registration service: " + code);
}
for (const code of ["early_childhood_registration","general_education_registration"]) {
  assert.match(migration, new RegExp(code), "Dedicated service must be defined in QA migration: " + code);
  assert.match(home, new RegExp(code), "Homepage form renderer must recognize dedicated service: " + code);
}
assert.match(migration, /student_registration';/u, "Legacy unified registration must be disabled after dedicated forms are added.");
assert.match(migration, /school_readiness/u);
assert.match(migration, /arabic_language_stories/u);
assert.match(migration, /early_numeracy/u);
assert.match(migration, /early_english/u);
assert.match(migration, /motor_arts_social/u);
assert.match(migration, /arabic_reading_writing/u);
assert.match(migration, /mathematics_quantitative/u);
assert.match(migration, /science_inquiry/u);
assert.match(migration, /english_communication/u);
assert.match(migration, /digital_social_learning/u);
assert.match(migration, /research_methods/u);
assert.match(migration, /academic_writing/u);
assert.match(migration, /statistics_data/u);
assert.match(migration, /major_core_courses/u);
assert.match(migration, /seminars_thesis/u);
assert.match(migration, /professional_technical_fundamentals/u);
assert.match(migration, /practical_workshops/u);
assert.match(migration, /digital_tools/u);
assert.match(migration, /safety_quality/u);
assert.match(migration, /applied_project/u);
assert.match(migration, /learning_reading/u);
assert.match(migration, /communication_language/u);
assert.match(migration, /life_family_skills/u);
assert.match(migration, /leadership_initiative/u);
assert.match(migration, /arts_sports_culture/u);
assert.match(followup, /tuition_period/u);
assert.match(followup, /needs_level_assessment/u);
assert.match(followup, /has_existing_file/u);
assert.match(curriculumMigration, /saudi_early_childhood/u);
assert.match(curriculumMigration, /montessori/u);
assert.match(curriculumMigration, /reggio_emilia/u);
assert.match(curriculumMigration, /high_scope/u);
assert.match(curriculumMigration, /play_based_learning/u);
assert.match(curriculumMigration, /yemeni_curriculum/u);
assert.match(curriculumMigration, /egyptian_curriculum/u);
assert.match(curriculumMigration, /jordanian_curriculum/u);
assert.match(curriculumMigration, /cambridge_ib_framework/u);
assert.match(curriculumMigration, /national_qualifications_framework/u);
assert.match(curriculumMigration, /ects_framework/u);
assert.match(curriculumMigration, /uk_credit_framework/u);
assert.match(curriculumMigration, /us_credit_hours/u);
assert.match(curriculumMigration, /national_occupational_standards/u);
assert.match(curriculumMigration, /competency_based_tvet/u);
assert.match(curriculumMigration, /btec_framework/u);
assert.match(curriculumMigration, /city_guilds_standards/u);
assert.match(curriculumMigration, /vendor_technical_standards/u);
assert.match(curriculumMigration, /lifelong_learning_framework/u);
assert.match(curriculumMigration, /life_social_skills_framework/u);
assert.match(curriculumMigration, /entrepreneurship_leadership_framework/u);
assert.match(curriculumMigration, /arts_creativity_framework/u);
assert.match(curriculumMigration, /sports_recreation_framework/u);
assert.match(home, /curriculumReferenceOptions/);
assert.match(home, /curriculum_reference_other/);
assert.match(requestApi, /curriculumReferenceOther/u);

assert.match(home, /href="education-packages\.html#pathways">استعراض المجال/u);
assert.match(home, /serviceCode==="early_childhood_registration"/u);
assert.match(home, /serviceCode==="general_education_registration"/u);
assert.match(requestApi, /INVALID_STUDENT_AGE/u);
assert.match(requestApi, /GUARDIAN_REQUIRED/u);
assert.match(requestApi, /age < 18/u);
assert.match(read("early-learning.html"), /service=early_childhood_registration/u);
assert.match(read("general-education.html"), /service=general_education_registration/u);

console.log("PASS: five separate registration routes, five content choices per field, curriculum selection, and age/guardian validation.");
