if col_length('dbo.patients', 'patient_voice_profile') is null
  alter table dbo.patients add patient_voice_profile nvarchar(max) null;

if col_length('dbo.patients', 'patient_voice_check_ins') is null
  alter table dbo.patients add patient_voice_check_ins nvarchar(max) not null
    constraint df_patients_voice_check_ins default '[]';

if col_length('dbo.patients', 'family_sharing') is null
  alter table dbo.patients add family_sharing nvarchar(max) null;

if col_length('dbo.patients', 'family_contributions') is null
  alter table dbo.patients add family_contributions nvarchar(max) not null
    constraint df_patients_family_contributions default '[]';
