/* =========================
   SUPABASE ANONYMOUS USER
========================= */
async function ensureAnonymousUser() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    return null;
  }

  if (sessionData.session && sessionData.session.user) {
    return sessionData.session.user;
  }

  const { data, error } = await supabaseClient.auth.signInAnonymously();

  if (error) {
    console.error("Anonymous sign-in error:", error);
    return null;
  }

  return data.user;
}

async function saveProfileToSupabase(profileData) {
  const user = await ensureAnonymousUser();

  console.log("Anonymous user for profile save:", user);

  if (!user) {
    console.error("No anonymous user found.");
    return false;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: profileData.fullName,
      age: profileData.age,
      weight_kg: profileData.weight,
      height_cm: profileData.height,
      bmi: profileData.bmi
    })
    .select();

  console.log("Profile save response data:", data);

  if (error) {
    console.error("Profile save error full:", error);
    return false;
  }

  return true;
}

async function loadProfileFromSupabase() {
  const user = await ensureAnonymousUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Profile load error:", error);
    return null;
  }

  if (!data) return null;

  return {
    fullName: data.full_name || "",
    age: data.age || "",
    weight: data.weight_kg || "",
    height: data.height_cm || "",
    bmi: data.bmi || null
  };
}

async function saveActivityToSupabase(activityData) {
  const user = await ensureAnonymousUser();
  console.log("Anonymous user for activity save:", user);

  if (!user) return false;

  const profile = JSON.parse(localStorage.getItem("healthtrackProfile")) || {};

  const payload = {
    user_id: user.id,
    full_name: profile.fullName || "Guest",
    activity_date: activityData.activityDate,
    intensity: activityData.intensity,
    steps: activityData.steps,
    heart_rate: activityData.heartRate,
    calories: activityData.calories,
    bmi: activityData.bmi,
    distance_km: activityData.distanceKm,
    exercises_completed: activityData.exercisesCompleted,
    feedback: activityData.feedback
  };

  console.log("Activity payload:", payload);

  const { data, error } = await supabaseClient
    .from("activity_logs")
    .insert(payload)
    .select();

  console.log("Activity save response:", data);

  if (error) {
    console.error("Activity save error full:", error);
    return false;
  }

  return true;
}

async function loadActivityHistoryFromSupabase() {
  const user = await ensureAnonymousUser();
  if (!user) return [];

  const { data, error } = await supabaseClient
    .from("activity_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Activity history load error:", error);
    return [];
  }

  return (data || []).map((item) => ({
    date: item.activity_date,
    intensity: item.intensity,
    steps: item.steps,
    heartRate: item.heart_rate,
    calories: item.calories,
    bmi: item.bmi,
    distance: item.distance_km,
    exercisesCompleted: item.exercises_completed,
    feedback: item.feedback
  }));
}

/* =========================
   RESET DATA ON FIRST LOAD OF TAB
========================= */
if (!sessionStorage.getItem("healthtrackSessionStarted")) {
  localStorage.removeItem("healthtrackProfile");
  localStorage.removeItem("healthtrackToday");
  localStorage.removeItem("healthtrackHistory");
  sessionStorage.setItem("healthtrackSessionStarted", "true");
}
document.addEventListener("DOMContentLoaded", () => {
  /* ---------------------------
     PROFILE PAGE
  --------------------------- */
  const profileForm = document.getElementById("profileForm");

  if (profileForm) {
    const fullNameInput = document.getElementById("fullName");
    const ageInput = document.getElementById("age");
    const weightInput = document.getElementById("weight");
    const heightInput = document.getElementById("height");

    const bmiNumber = document.getElementById("bmiNumber");
    const bmiBadge = document.getElementById("bmiBadge");
    const bmiCircle = document.getElementById("bmiCircle");
    const profileSummaryText = document.getElementById("profileSummaryText");
    const profileMessage = document.getElementById("profileMessage");

    function calculateBMI(weightKg, heightCm) {
      const heightM = heightCm / 100;
      if (!heightM || heightM <= 0) return null;
      return weightKg / (heightM * heightM);
    }

    function getBMICategory(bmi) {
      if (bmi < 18.5) {
        return {
          label: "Underweight",
          circleClass: "bmi-underweight",
          badgeClass: "badge-underweight",
          summary: "Your BMI is below the healthy range. You may need better nutrition and medical advice for healthy weight gain."
        };
      }

      if (bmi <= 24.9) {
        return {
          label: "Normal Weight",
          circleClass: "bmi-normal",
          badgeClass: "badge-normal",
          summary: "Your BMI is in the healthy range. Keep maintaining balanced nutrition and regular activity."
        };
      }

      if (bmi <= 29.9) {
        return {
          label: "Overweight",
          circleClass: "bmi-overweight",
          badgeClass: "badge-overweight",
          summary: "Your BMI is above the healthy range. Improving food choices and daily activity can help."
        };
      }

      return {
        label: "Obese",
        circleClass: "bmi-obese",
        badgeClass: "badge-obese",
        summary: "Your BMI is in the obese range. It is best to speak with a healthcare professional for a safe plan."
      };
    }

    function clearBMIClasses() {
      bmiCircle.classList.remove("bmi-underweight", "bmi-normal", "bmi-overweight", "bmi-obese");
      bmiBadge.classList.remove("badge-underweight", "badge-normal", "badge-overweight", "badge-obese");
    }

    function resetBMIUI() {
      clearBMIClasses();
      bmiNumber.textContent = "--";
      bmiBadge.textContent = "No Data";
      profileSummaryText.textContent = "Complete all profile fields and save to see your BMI result and summary.";
      profileMessage.textContent = "";
    }

    function allFieldsFilled(fullName, age, weight, height) {
      return (
        fullName.trim() !== "" &&
        Number.isFinite(age) && age > 0 &&
        Number.isFinite(weight) && weight > 0 &&
        Number.isFinite(height) && height > 0
      );
    }

    function updateBMIUI(weight, height) {
      const bmi = calculateBMI(weight, height);

      if (!bmi || !isFinite(bmi)) {
        resetBMIUI();
        return null;
      }

      const bmiRounded = Number(bmi.toFixed(1));
      const category = getBMICategory(bmiRounded);

      clearBMIClasses();
      bmiCircle.classList.add(category.circleClass);
      bmiBadge.classList.add(category.badgeClass);

      bmiNumber.textContent = bmiRounded.toFixed(1);
      bmiBadge.textContent = category.label;
      profileSummaryText.textContent = category.summary;

      return bmiRounded;
    }

    async function fillInputsFromSavedProfile() {
      const savedProfile = await loadProfileFromSupabase();
    
      if (savedProfile?.fullName) fullNameInput.value = savedProfile.fullName;
      if (savedProfile?.age) ageInput.value = savedProfile.age;
      if (savedProfile?.weight) weightInput.value = savedProfile.weight;
      if (savedProfile?.height) heightInput.value = savedProfile.height;
    }

    resetBMIUI();
    fillInputsFromSavedProfile();

    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
    
      const fullName = fullNameInput.value.trim();
      const age = Number(ageInput.value);
      const weight = Number(weightInput.value);
      const height = Number(heightInput.value);
    
      if (!allFieldsFilled(fullName, age, weight, height)) {
        resetBMIUI();
        profileMessage.textContent = "Please fill in all 4 fields correctly.";
        return;
      }
    
      const bmi = updateBMIUI(weight, height);
    
      const profileData = {
        fullName,
        age,
        weight,
        height,
        bmi
      };
    
      localStorage.setItem("healthtrackProfile", JSON.stringify(profileData));
    
      const todayData = JSON.parse(localStorage.getItem("healthtrackToday")) || {};
      todayData.bmi = bmi;
      localStorage.setItem("healthtrackToday", JSON.stringify(todayData));
    
      profileMessage.textContent = "Saving profile...";
    
      const saved = await saveProfileToSupabase(profileData);
    
      if (saved) {
        profileMessage.textContent = "Profile saved successfully.";
      } else {
        profileMessage.textContent = "Profile saved locally, but database save failed.";
      }
    });
  }

  /* ---------------------------
   DASHBOARD PAGE
--------------------------- */
const dashboardUserName = document.getElementById("dashboardUserName");

if (dashboardUserName) {
  const profile = JSON.parse(localStorage.getItem("healthtrackProfile")) || {};
  const historyData = JSON.parse(localStorage.getItem("healthtrackHistory")) || [];

  const todayKey = new Date().toISOString().slice(0, 10);

  const todayEntries = historyData.filter((item) => {
    const itemDay = String(item.date).slice(0, 10);
    return itemDay === todayKey;
  });

  const steps = todayEntries.reduce((sum, item) => sum + Number(item.steps || 0), 0);
  const calories = todayEntries.reduce((sum, item) => sum + Number(item.calories || 0), 0);

  const heartValues = todayEntries
    .map((item) => Number(item.heartRate || 0))
    .filter((value) => value > 0);

  const bmiValues = todayEntries
    .map((item) => Number(item.bmi || 0))
    .filter((value) => value > 0);

  const heartRate = heartValues.length
    ? Math.round(heartValues.reduce((sum, value) => sum + value, 0) / heartValues.length)
    : null;

  const bmi = bmiValues.length
    ? (bmiValues.reduce((sum, value) => sum + value, 0) / bmiValues.length)
    : (profile.bmi ? Number(profile.bmi) : null);

  const stepGoal = 10000;
  const progressPercent = Math.min((steps / stepGoal) * 100, 100);

  dashboardUserName.textContent = profile.fullName || "Guest";

  const dailyStepsValue = document.getElementById("dailyStepsValue");
  const heartRateValue = document.getElementById("heartRateValue");
  const caloriesValue = document.getElementById("caloriesValue");
  const bmiValue = document.getElementById("bmiValue");
  const stepsProgressText = document.getElementById("stepsProgressText");
  const stepsPercentText = document.getElementById("stepsPercentText");
  const stepsProgressBar = document.getElementById("stepsProgressBar");
  const summaryHeart = document.getElementById("summaryHeart");
  const summaryCaloriesPerStep = document.getElementById("summaryCaloriesPerStep");
  const summaryDistance = document.getElementById("summaryDistance");
  const summaryActivityLevel = document.getElementById("summaryActivityLevel");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const feedbackTip = document.getElementById("feedbackTip");

  if (dailyStepsValue) dailyStepsValue.textContent = steps.toLocaleString();
  if (heartRateValue) heartRateValue.textContent = heartRate ? `${heartRate} bpm` : "-- bpm";
  if (caloriesValue) caloriesValue.textContent = calories.toLocaleString();
  if (bmiValue) bmiValue.textContent = bmi ? bmi.toFixed(1) : "--";

  if (stepsProgressText) stepsProgressText.textContent = steps.toLocaleString();
  if (stepsPercentText) stepsPercentText.textContent = Math.round(progressPercent);
  if (stepsProgressBar) stepsProgressBar.style.width = `${progressPercent}%`;

  const avgHeart = heartRate ? `${heartRate} bpm` : "No data";
  const caloriesPerStep = steps > 0 ? (calories / steps).toFixed(2) : "0.00";
  const distanceKm = (steps * 0.0008).toFixed(1);

  let activityLevel = "Low";
  if (steps >= 8000) activityLevel = "High";
  else if (steps >= 4000) activityLevel = "Moderate";

  if (summaryHeart) summaryHeart.textContent = avgHeart;
  if (summaryCaloriesPerStep) summaryCaloriesPerStep.textContent = caloriesPerStep;
  if (summaryDistance) summaryDistance.textContent = `${distanceKm} km`;
  if (summaryActivityLevel) summaryActivityLevel.textContent = activityLevel;

  if (feedbackTitle && feedbackTip) {
    if (steps >= 10000) {
      feedbackTitle.textContent = "Excellent Work - You've reached your daily goal!";
      feedbackTip.textContent = "Tip: Keep this consistency going to support your long-term health and fitness progress.";
    } else if (steps >= 5000) {
      feedbackTitle.textContent = "Good Progress - You're on the right track!";
      feedbackTip.textContent = "Tip: A short walk later today can help you get even closer to your daily target.";
    } else {
      feedbackTitle.textContent = "Need More Activity - Keep moving to reach your goal!";
      feedbackTip.textContent = "Tip: Regular physical activity helps maintain cardiovascular health and supports overall wellness.";
    }
  }
}

  /* ---------------------------
     LOG ACTIVITY PAGE
  --------------------------- */
  const generateWorkoutBtn = document.getElementById("generateWorkoutBtn");

  if (generateWorkoutBtn) {
    const profile = JSON.parse(localStorage.getItem("healthtrackProfile")) || {};
    const profileBMI = profile.bmi ? Number(profile.bmi).toFixed(1) : "--";
    const displayName = profile.fullName || "Guest";
    const displayAvatar = displayName.trim().charAt(0).toUpperCase();

    const activityUserName = document.getElementById("activityUserName");
    const activityUserAvatar = document.getElementById("activityUserAvatar");

    if (activityUserName) activityUserName.textContent = displayName;
    if (activityUserAvatar) activityUserAvatar.textContent = displayAvatar;

    const workouts = {
      low: {
        label: "LOW",
        exercises: [
          { title: "Walking in Place", sub: "⏱ 5 minutes" },
          { title: "Arm Circles", sub: "∿ 10 each direction" },
          { title: "Gentle Stretching", sub: "⏱ 5 minutes" },
          { title: "Seated Leg Raises", sub: "∿ 10 reps" },
          { title: "Wall Push-ups", sub: "∿ 8 reps" },
          { title: "Standing Knee Lifts", sub: "∿ 10 each leg" }
        ],
        results: {
          steps: 2402,
          heartRate: 65,
          calories: 96,
          feedback: "🌟 Nice low-intensity movement! Light activity is important for recovery and maintaining mobility. Consider gradually increasing intensity.",
          distance: "1.92 km"
        }
      },
      moderate: {
        label: "MODERATE",
        exercises: [
          { title: "Brisk Walking", sub: "⏱ 10 minutes" },
          { title: "Jumping Jacks", sub: "∿ 20 reps" },
          { title: "Bodyweight Squats", sub: "∿ 15 reps" },
          { title: "Lunges", sub: "∿ 10 each leg" },
          { title: "March in Place", sub: "⏱ 4 minutes" },
          { title: "Plank Hold", sub: "⏱ 30 seconds" }
        ],
        results: {
          steps: 4860,
          heartRate: 88,
          calories: 214,
          feedback: "🔥 Great moderate workout! You are improving endurance and cardiovascular fitness. Keep building consistency.",
          distance: "3.89 km"
        }
      },
      high: {
        label: "HIGH",
        exercises: [
          { title: "Burpees", sub: "∿ 15 reps" },
          { title: "Jump Squats", sub: "∿ 20 reps" },
          { title: "High Knees", sub: "⏱ 1 minute" },
          { title: "Push-ups", sub: "∿ 20 reps" },
          { title: "Jumping Lunges", sub: "∿ 12 each leg" },
          { title: "Mountain Climbers", sub: "∿ 30 reps" }
        ],
        results: {
          steps: 7825,
          heartRate: 122,
          calories: 356,
          feedback: "🚀 Strong high-intensity session! This level boosts stamina and calorie burn. Make sure to hydrate and recover properly.",
          distance: "6.26 km"
        }
      }
    };

    const intensityButtons = document.querySelectorAll(".intensity-option");
    const workoutCard = document.getElementById("workoutCard");
    const exerciseList = document.getElementById("exerciseList");
    const workoutProgressBadge = document.getElementById("workoutProgressBadge");
    const completeWorkoutBtn = document.getElementById("completeWorkoutBtn");
    const resetWorkoutBtn = document.getElementById("resetWorkoutBtn");
    const workoutWarning = document.getElementById("workoutWarning");

    const activitySuccessCard = document.getElementById("activitySuccessCard");
    const activityResultsCard = document.getElementById("activityResultsCard");
    const activityFeedbackCard = document.getElementById("activityFeedbackCard");
    const startAnotherWorkoutBtn = document.getElementById("startAnotherWorkoutBtn");

    const resultSteps = document.getElementById("resultSteps");
    const resultHeartRate = document.getElementById("resultHeartRate");
    const resultCalories = document.getElementById("resultCalories");
    const resultBMI = document.getElementById("resultBMI");
    const resultIntensityBadge = document.getElementById("resultIntensityBadge");
    const activityFeedbackText = document.getElementById("activityFeedbackText");
    const resultDistance = document.getElementById("resultDistance");
    const resultExercisesCompleted = document.getElementById("resultExercisesCompleted");

    let selectedIntensity = "low";
    let generatedIntensity = null;
    let generatedExercises = [];

    function hideGeneratedSections() {
      workoutCard.classList.add("hidden");
      activitySuccessCard.classList.add("hidden");
      activityResultsCard.classList.add("hidden");
      activityFeedbackCard.classList.add("hidden");
      startAnotherWorkoutBtn.classList.add("hidden");
    }

    function resetCurrentWorkoutState() {
      generatedIntensity = null;
      generatedExercises = [];
      exerciseList.innerHTML = "";
      workoutProgressBadge.textContent = "0%";
      completeWorkoutBtn.classList.add("disabled");
      completeWorkoutBtn.textContent = "Complete All Exercises First";
      workoutWarning.classList.remove("hidden");
      hideGeneratedSections();
    }

    intensityButtons.forEach((button) => {
      button.addEventListener("click", () => {
        intensityButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        selectedIntensity = button.dataset.intensity;
        resetCurrentWorkoutState();
      });
    });

    function renderExercises() {
      exerciseList.innerHTML = "";

      generatedExercises.forEach((exercise, index) => {
        const card = document.createElement("div");
        card.className = `exercise-item ${exercise.done ? "done" : ""}`;
        card.dataset.index = index;

        card.innerHTML = `
          <div class="exercise-left">
            <div class="exercise-check">${exercise.done ? "✓" : ""}</div>
            <div>
              <div class="exercise-title">${exercise.title}</div>
              <div class="exercise-sub">${exercise.sub}</div>
            </div>
          </div>
          <div class="exercise-done-icon">✓</div>
        `;

        card.addEventListener("click", () => {
          generatedExercises[index].done = !generatedExercises[index].done;
          updateWorkoutUI();
        });

        exerciseList.appendChild(card);
      });
    }

    function updateWorkoutUI() {
      const doneCount = generatedExercises.filter((exercise) => exercise.done).length;
      const total = generatedExercises.length;
      const percent = total ? Math.round((doneCount / total) * 100) : 0;

      workoutProgressBadge.textContent = `${percent}%`;
      renderExercises();

      if (doneCount === total && total > 0) {
        completeWorkoutBtn.classList.remove("disabled");
        completeWorkoutBtn.textContent = "Complete Workout & Log Activity";
        workoutWarning.classList.add("hidden");
      } else {
        completeWorkoutBtn.classList.add("disabled");
        completeWorkoutBtn.textContent = "Complete All Exercises First";
        workoutWarning.classList.remove("hidden");
      }
    }

    function generateWorkout() {
      generatedIntensity = selectedIntensity;
      const selectedWorkout = workouts[generatedIntensity];
    
      generatedExercises = selectedWorkout.exercises.map((exercise) => ({
        ...exercise,
        done: false
      }));
    
      activitySuccessCard.classList.add("hidden");
      activityResultsCard.classList.add("hidden");
      activityFeedbackCard.classList.add("hidden");
      startAnotherWorkoutBtn.classList.add("hidden");
    
      workoutCard.classList.remove("hidden");
      updateWorkoutUI();
      workoutCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    async function saveActivityResults() {
      const selectedWorkout = workouts[generatedIntensity];
    
      resultSteps.textContent = selectedWorkout.results.steps.toLocaleString();
      resultHeartRate.textContent = selectedWorkout.results.heartRate;
      resultCalories.textContent = selectedWorkout.results.calories;
      resultBMI.textContent = profileBMI;
      resultIntensityBadge.textContent = selectedWorkout.label;
      activityFeedbackText.textContent = selectedWorkout.results.feedback;
      resultDistance.textContent = selectedWorkout.results.distance;
      resultExercisesCompleted.textContent = `${generatedExercises.length} exercises`;
    
      const todayData = JSON.parse(localStorage.getItem("healthtrackToday")) || {};
      todayData.steps = selectedWorkout.results.steps;
      todayData.heartRate = selectedWorkout.results.heartRate;
      todayData.calories = selectedWorkout.results.calories;
      todayData.bmi = profile.bmi || null;
      todayData.intensity = selectedWorkout.label;
      localStorage.setItem("healthtrackToday", JSON.stringify(todayData));
    
      const historyData = JSON.parse(localStorage.getItem("healthtrackHistory")) || [];
      historyData.unshift({
        date: new Date().toISOString(),
        intensity: selectedWorkout.label,
        steps: selectedWorkout.results.steps,
        heartRate: selectedWorkout.results.heartRate,
        calories: selectedWorkout.results.calories,
        bmi: profile.bmi || null,
        distance: selectedWorkout.results.distance,
        exercisesCompleted: generatedExercises.length,
        feedback: selectedWorkout.results.feedback
      });
      localStorage.setItem("healthtrackHistory", JSON.stringify(historyData));
    
      const activitySaved = await saveActivityToSupabase({
        activityDate: new Date().toISOString().slice(0, 10),
        intensity: selectedWorkout.label,
        steps: selectedWorkout.results.steps,
        heartRate: selectedWorkout.results.heartRate,
        calories: selectedWorkout.results.calories,
        bmi: profile.bmi || null,
        distanceKm: parseFloat(selectedWorkout.results.distance),
        exercisesCompleted: generatedExercises.length,
        feedback: selectedWorkout.results.feedback
      });
      
      if (!activitySaved) {
        console.error("Activity saved locally, but database save failed.");
      }
    }

    async function completeWorkout() {
      const allDone =
        generatedExercises.length > 0 &&
        generatedExercises.every((exercise) => exercise.done);
    
      if (!allDone) return;
    
      await saveActivityResults();
    
      activitySuccessCard.classList.remove("hidden");
      activityResultsCard.classList.remove("hidden");
      activityFeedbackCard.classList.remove("hidden");
      startAnotherWorkoutBtn.classList.remove("hidden");
      workoutWarning.classList.add("hidden");
    
      activitySuccessCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function resetWorkout() {
      resetCurrentWorkoutState();
    }

    generateWorkoutBtn.addEventListener("click", generateWorkout);
    resetWorkoutBtn.addEventListener("click", resetWorkout);
    startAnotherWorkoutBtn.addEventListener("click", resetWorkout);

    completeWorkoutBtn.addEventListener("click", async () => {
      if (completeWorkoutBtn.classList.contains("disabled")) return;
      await completeWorkout();
    });

    resetCurrentWorkoutState();
  }
});
/* ---------------------------
   HISTORY PAGE
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const historyUserName = document.getElementById("historyUserName");
  if (!historyUserName) return;

  const profile = JSON.parse(localStorage.getItem("healthtrackProfile")) || {};
  const historyData = JSON.parse(localStorage.getItem("healthtrackHistory")) || [];

  const userName = profile.fullName || "Guest";
  const userAvatar = userName.trim() ? userName.trim().charAt(0).toUpperCase() : "U";

  const historyUserAvatar = document.getElementById("historyUserAvatar");
  const historyAvgSteps = document.getElementById("historyAvgSteps");
  const historyAvgHeartRate = document.getElementById("historyAvgHeartRate");
  const historyAvgCalories = document.getElementById("historyAvgCalories");
  const historyAvgBMI = document.getElementById("historyAvgBMI");
  const historyEmptyState = document.getElementById("historyEmptyState");
  const historyLogList = document.getElementById("historyLogList");

  historyUserName.textContent = userName;
  historyUserAvatar.textContent = userAvatar;

  const last14 = historyData.slice(0, 14);

  if (!last14.length) {
    historyAvgSteps.textContent = "0";
    historyAvgHeartRate.textContent = "0";
    historyAvgCalories.textContent = "0";
    historyAvgBMI.textContent = "0";
    historyEmptyState.classList.remove("hidden");
    historyLogList.classList.add("hidden");
    return;
  }

  const avgSteps = Math.round(last14.reduce((sum, item) => sum + Number(item.steps || 0), 0) / last14.length);
  const avgHeartRate = Math.round(last14.reduce((sum, item) => sum + Number(item.heartRate || 0), 0) / last14.length);
  const avgCalories = Math.round(last14.reduce((sum, item) => sum + Number(item.calories || 0), 0) / last14.length);

  const bmiValues = last14
    .map((item) => Number(item.bmi))
    .filter((value) => Number.isFinite(value) && value > 0);

  const avgBMI = bmiValues.length
    ? (bmiValues.reduce((sum, value) => sum + value, 0) / bmiValues.length).toFixed(1)
    : "0";

  historyAvgSteps.textContent = avgSteps.toLocaleString();
  historyAvgHeartRate.textContent = avgHeartRate.toLocaleString();
  historyAvgCalories.textContent = avgCalories.toLocaleString();
  historyAvgBMI.textContent = avgBMI;

  historyEmptyState.classList.add("hidden");
  historyLogList.classList.remove("hidden");

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function getIntensityBadgeClass(intensity) {
    const value = String(intensity || "").toLowerCase();
    if (value === "low") return "intensity-low-badge";
    if (value === "moderate") return "intensity-moderate-badge";
    return "intensity-high-badge";
  }

  historyLogList.innerHTML = "";

  last14.forEach((item) => {
    const logItem = document.createElement("article");
    logItem.className = "history-log-item";

    const intensity = item.intensity || "LOW";
    const badgeClass = getIntensityBadgeClass(intensity);

    logItem.innerHTML = `
      <div class="history-log-top">
        <div class="history-log-date">${formatDate(item.date)}</div>
        <div class="history-log-intensity ${badgeClass}">${intensity}</div>
      </div>

      <div class="history-log-grid">
        <div class="history-log-metric">
          <p>Steps</p>
          <h4>${Number(item.steps || 0).toLocaleString()}</h4>
        </div>

        <div class="history-log-metric">
          <p>Heart Rate</p>
          <h4>${Number(item.heartRate || 0)} bpm</h4>
        </div>

        <div class="history-log-metric">
          <p>Calories</p>
          <h4>${Number(item.calories || 0)}</h4>
        </div>

        <div class="history-log-metric">
          <p>BMI</p>
          <h4>${item.bmi ? Number(item.bmi).toFixed(1) : "--"}</h4>
        </div>
      </div>
    `;

    historyLogList.appendChild(logItem);
  });
});
/* ---------------------------
   RECOMMENDATIONS PAGE
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const recommendUserName = document.getElementById("recommendUserName");
  if (!recommendUserName) return;

  const profile = JSON.parse(localStorage.getItem("healthtrackProfile")) || {};
  const todayData = JSON.parse(localStorage.getItem("healthtrackToday")) || {};
  const historyData = JSON.parse(localStorage.getItem("healthtrackHistory")) || [];

  const userName = profile.fullName || "Guest";
  const firstName = userName.trim().split(" ")[0] || "User";
  const avatar = firstName.charAt(0).toUpperCase();

  document.getElementById("recommendUserName").textContent = userName;
  document.getElementById("recommendUserAvatar").textContent = avatar;
  document.getElementById("recommendHeroBadge").textContent = `Recommended for ${firstName}`;

  const age = Number(profile.age || 0);
  const bmi = Number(profile.bmi || 0);
  const avgSteps =
    historyData.length > 0
      ? Math.round(historyData.reduce((sum, item) => sum + Number(item.steps || 0), 0) / historyData.length)
      : Number(todayData.steps || 0);

  let planTitle = "Balanced Fitness Plan";
  let planSubtitle = "A personalized plan designed to match your profile and support steady progress.";
  let sessions = "4";
  let duration = "30-45 minutes";
  let stepsGoal = "10,000";
  let focus = "Cardio + Strength";

  let cardioList = [
    "Brisk walking 3-4 times per week",
    "Light jogging sessions for endurance",
    "Cycling or swimming for variety",
    "Active recovery walks on rest days"
  ];

  let strengthList = [
    "Full-body resistance training 2-3 times per week",
    "Compound movements like squats and presses",
    "Bodyweight exercises like push-ups and lunges",
    "Core strengthening exercises"
  ];

  let notesText =
    "Focus on consistency and gradual improvement. Balance cardio, strength work, hydration, and recovery for better long-term fitness.";

  if (age > 0 && age <= 25 && bmi >= 18.5 && bmi <= 24.9) {
    planTitle = "Youth Fitness Plan";
    planSubtitle = "High-energy program designed for young adults with excellent recovery capacity.";
    sessions = "5";
    duration = "45-60 minutes";
    stepsGoal = "12,000";
    focus = "Cardio + Strength";

    cardioList = [
      "Running or jogging 3-4 times per week",
      "HIIT workouts 2 times per week",
      "Cycling or swimming for variety",
      "Sports activities (basketball, soccer, tennis)"
    ];

    strengthList = [
      "Full-body weight training 3 times per week",
      "Compound movements (squats, deadlifts, bench press)",
      "Bodyweight exercises (push-ups, pull-ups)",
      "Core strengthening exercises"
    ];

    notesText =
      "Focus on building strong fitness foundations. Maintain high intensity with adequate rest. Stay hydrated and fuel properly for recovery.";
  } else if (bmi > 0 && bmi < 18.5) {
    planTitle = "Healthy Weight Gain Plan";
    planSubtitle = "Supportive program focused on gradual strength building, light cardio, and healthy progress.";
    sessions = "4";
    duration = "30-40 minutes";
    stepsGoal = "8,000";
    focus = "Strength + Recovery";

    cardioList = [
      "Light walking 4-5 times per week",
      "Low-impact cycling or mobility sessions",
      "Short recovery cardio after strength workouts",
      "Avoid excessive long-duration cardio"
    ];

    strengthList = [
      "Strength training 3 times per week",
      "Progressive overload with basic compound exercises",
      "Focus on muscle-building movements",
      "Longer recovery and proper nutrition support"
    ];

    notesText =
      "Because your BMI is below the healthy range, focus more on strength, nutrition, and recovery rather than excessive calorie-burning cardio.";
  } else if (bmi >= 25 && bmi < 30) {
    planTitle = "Fat Loss Fitness Plan";
    planSubtitle = "Structured plan focused on calorie burn, consistency, and improving body composition.";
    sessions = "5";
    duration = "40-55 minutes";
    stepsGoal = "11,000";
    focus = "Cardio + Fat Loss";

    cardioList = [
      "Brisk walking or treadmill sessions 4 times per week",
      "Moderate-intensity cycling sessions",
      "Interval training 1-2 times per week",
      "Increase general daily movement"
    ];

    strengthList = [
      "Strength training 3 times per week",
      "Full-body routines with short rest periods",
      "Bodyweight + machine exercises",
      "Core and posture work"
    ];

    notesText =
      "A combination of cardio, strength training, and daily movement will help support a healthier BMI and better long-term fitness.";
  } else if (bmi >= 30) {
    planTitle = "Gentle Start Fitness Plan";
    planSubtitle = "Safe and progressive plan designed to build consistency, mobility, and cardiovascular health.";
    sessions = "4";
    duration = "25-35 minutes";
    stepsGoal = "7,500";
    focus = "Mobility + Cardio";

    cardioList = [
      "Walking sessions 5 times per week",
      "Low-impact cycling or elliptical workouts",
      "Chair cardio or beginner movement routines",
      "Gradually increase workout duration"
    ];

    strengthList = [
      "Low-impact strength sessions 2-3 times weekly",
      "Chair-assisted or machine-supported exercises",
      "Light resistance band training",
      "Mobility and flexibility exercises"
    ];

    notesText =
      "Start with manageable sessions and increase gradually. Low-impact consistency is more important than intensity at the beginning.";
  }

  if (avgSteps >= 8000 && bmi >= 18.5 && bmi <= 24.9 && age >= 18 && age <= 30) {
    planTitle = "Youth Fitness Plan";
  }

  document.getElementById("recommendPlanTitle").textContent = planTitle;
  document.getElementById("recommendPlanSubtitle").textContent = planSubtitle;
  document.getElementById("recommendSessions").textContent = sessions;
  document.getElementById("recommendDuration").textContent = duration;
  document.getElementById("recommendSteps").textContent = stepsGoal;
  document.getElementById("recommendFocus").textContent = focus;
  document.getElementById("recommendNotesText").textContent = notesText;

  const cardioListEl = document.getElementById("recommendCardioList");
  const strengthListEl = document.getElementById("recommendStrengthList");

  cardioListEl.innerHTML = "";
  strengthListEl.innerHTML = "";

  cardioList.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    cardioListEl.appendChild(li);
  });

  strengthList.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    strengthListEl.appendChild(li);
  });
});
/* ---------------------------
   ANALYTICS PAGE
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const analyticsUserName = document.getElementById("analyticsUserName");
  if (!analyticsUserName) return;

  const profile = JSON.parse(localStorage.getItem("healthtrackProfile")) || {};
  const historyData = JSON.parse(localStorage.getItem("healthtrackHistory")) || [];

  const userName = profile.fullName || "Guest";
  const avatar = userName.trim() ? userName.trim().charAt(0).toUpperCase() : "U";

  document.getElementById("analyticsUserName").textContent = userName;
  document.getElementById("analyticsUserAvatar").textContent = avatar;

  const stepsChartSvg = document.getElementById("stepsChartSvg");
  const heartChartSvg = document.getElementById("heartChartSvg");
  const caloriesChartSvg = document.getElementById("caloriesChartSvg");
  const bmiChartSvg = document.getElementById("bmiChartSvg");
  const intensityBarSvg = document.getElementById("intensityBarSvg");

  const bmiPieChart = document.getElementById("bmiPieChart");
  const bmiPieLabel = document.getElementById("bmiPieLabel");

  const groupedByDay = {};

historyData.forEach((item) => {
  const d = new Date(item.date);
  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (!groupedByDay[dayKey]) {
    groupedByDay[dayKey] = {
      date: dayKey,
      steps: 0,
      heartRate: 0,
      calories: 0,
      bmi: 0,
      count: 0,
      bmiCount: 0,
      intensity: item.intensity || "LOW"
    };
  }

  groupedByDay[dayKey].steps += Number(item.steps || 0);
  groupedByDay[dayKey].heartRate += Number(item.heartRate || 0);
  groupedByDay[dayKey].calories += Number(item.calories || 0);
  groupedByDay[dayKey].count += 1;

  if (Number(item.bmi) > 0) {
    groupedByDay[dayKey].bmi += Number(item.bmi);
    groupedByDay[dayKey].bmiCount += 1;
  }

  groupedByDay[dayKey].intensity = item.intensity || groupedByDay[dayKey].intensity;
});

const last14 = Object.values(groupedByDay)
  .map((item) => ({
    date: item.date,
    steps: item.steps,
    heartRate: item.count ? Math.round(item.heartRate / item.count) : 0,
    calories: item.calories,
    bmi: item.bmiCount ? Number((item.bmi / item.bmiCount).toFixed(1)) : 0,
    intensity: item.intensity
  }))
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .slice(-14);

  function formatShortDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }

  function createSVGChart(svgEl, data, key, options) {
    const width = 900;
    const height = options.height || 340;
    const padding = { top: 20, right: 20, bottom: 50, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svgEl.innerHTML = "";

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", padding.left);
    bg.setAttribute("y", padding.top);
    bg.setAttribute("width", chartWidth);
    bg.setAttribute("height", chartHeight);
    bg.setAttribute("fill", "transparent");
    svgEl.appendChild(bg);

    const gridSteps = 4;

    for (let i = 0; i <= gridSteps; i++) {
      const y = padding.top + (chartHeight / gridSteps) * i;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", padding.left);
      line.setAttribute("y1", y);
      line.setAttribute("x2", padding.left + chartWidth);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(88, 132, 170, 0.18)");
      line.setAttribute("stroke-dasharray", "4 4");
      svgEl.appendChild(line);

      const value = Math.round(options.max - (options.max / gridSteps) * i);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", padding.left - 10);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("fill", "#8fb9df");
      label.setAttribute("font-size", "12");
      label.textContent = value;
      svgEl.appendChild(label);
    }

    const axisX = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisX.setAttribute("x1", padding.left);
    axisX.setAttribute("y1", padding.top + chartHeight);
    axisX.setAttribute("x2", padding.left + chartWidth);
    axisX.setAttribute("y2", padding.top + chartHeight);
    axisX.setAttribute("stroke", "#7aaacc");
    axisX.setAttribute("stroke-width", "2");
    svgEl.appendChild(axisX);

    const axisY = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisY.setAttribute("x1", padding.left);
    axisY.setAttribute("y1", padding.top);
    axisY.setAttribute("x2", padding.left);
    axisY.setAttribute("y2", padding.top + chartHeight);
    axisY.setAttribute("stroke", "#7aaacc");
    axisY.setAttribute("stroke-width", "2");
    svgEl.appendChild(axisY);

    if (!data.length) return;

    const points = data.map((item, index) => {
      const value = Number(item[key] || 0);
      const x = data.length === 1
        ? padding.left + chartWidth / 2
        : padding.left + (chartWidth / (data.length - 1)) * index;
      const y = padding.top + chartHeight - (Math.min(value, options.max) / options.max) * chartHeight;
      return { x, y, value, date: item.date };
    });

    let pathData = "";
    points.forEach((point, index) => {
      pathData += `${index === 0 ? "M" : "L"} ${point.x} ${point.y} `;
    });

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData.trim());
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", options.color);
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svgEl.appendChild(path);

    points.forEach((point) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", "6");
      circle.setAttribute("fill", options.color);
      svgEl.appendChild(circle);
    });

    points.forEach((point) => {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", point.x);
      label.setAttribute("y", padding.top + chartHeight + 26);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "#8fb9df");
      label.setAttribute("font-size", "12");
      label.textContent = formatShortDate(point.date);
      svgEl.appendChild(label);
    });
  }

  function createBarChart(svgEl, bars) {
    const width = 460;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 55, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svgEl.innerHTML = "";

    const maxValue = Math.max(...bars.map((b) => b.value), 1000);
    const gridSteps = 4;

    for (let i = 0; i <= gridSteps; i++) {
      const y = padding.top + (chartHeight / gridSteps) * i;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", padding.left);
      line.setAttribute("y1", y);
      line.setAttribute("x2", padding.left + chartWidth);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(88, 132, 170, 0.18)");
      line.setAttribute("stroke-dasharray", "4 4");
      svgEl.appendChild(line);

      const value = Math.round(maxValue - (maxValue / gridSteps) * i);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", padding.left - 10);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("fill", "#8fb9df");
      label.setAttribute("font-size", "12");
      label.textContent = value;
      svgEl.appendChild(label);
    }

    const axisX = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisX.setAttribute("x1", padding.left);
    axisX.setAttribute("y1", padding.top + chartHeight);
    axisX.setAttribute("x2", padding.left + chartWidth);
    axisX.setAttribute("y2", padding.top + chartHeight);
    axisX.setAttribute("stroke", "#7aaacc");
    axisX.setAttribute("stroke-width", "2");
    svgEl.appendChild(axisX);

    const axisY = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisY.setAttribute("x1", padding.left);
    axisY.setAttribute("y1", padding.top);
    axisY.setAttribute("x2", padding.left);
    axisY.setAttribute("y2", padding.top + chartHeight);
    axisY.setAttribute("stroke", "#7aaacc");
    axisY.setAttribute("stroke-width", "2");
    svgEl.appendChild(axisY);

    const slotWidth = chartWidth / bars.length;
    const barWidth = Math.min(90, slotWidth * 0.6);

    bars.forEach((bar, index) => {
      const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
      const barHeight = (bar.value / maxValue) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", barWidth);
      rect.setAttribute("height", barHeight);
      rect.setAttribute("rx", "10");
      rect.setAttribute("fill", "#5db7e2");
      svgEl.appendChild(rect);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", x + barWidth / 2);
      label.setAttribute("y", padding.top + chartHeight + 26);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "#8fb9df");
      label.setAttribute("font-size", "12");
      label.textContent = bar.label;
      svgEl.appendChild(label);
    });
  }

  createSVGChart(stepsChartSvg, last14, "steps", {
    max: 10000,
    color: "#63c7fb",
    height: 340
  });

  createSVGChart(heartChartSvg, last14, "heartRate", {
    max: 100,
    color: "#ff6f70",
    height: 340
  });

  createSVGChart(caloriesChartSvg, last14, "calories", {
    max: 600,
    color: "#ffd05f",
    height: 260
  });

  createSVGChart(bmiChartSvg, last14, "bmi", {
    max: 35,
    color: "#18dfad",
    height: 260
  });

  const bmiValues = last14
    .map((item) => Number(item.bmi))
    .filter((value) => Number.isFinite(value) && value > 0);

  let normalCount = 0;
  const totalBMI = bmiValues.length;

  bmiValues.forEach((bmi) => {
    if (bmi >= 18.5 && bmi <= 24.9) normalCount++;
  });

  const normalPercent = totalBMI ? Math.round((normalCount / totalBMI) * 100) : 0;

  bmiPieChart.style.background = totalBMI
    ? `conic-gradient(#1ccca0 0% ${normalPercent}%, #2d4052 ${normalPercent}% 100%)`
    : "#2d4052";

  bmiPieLabel.textContent = `Normal Weight: ${normalPercent}%`;

  const totalsByIntensity = {
    low: 0,
    moderate: 0,
    high: 0
  };

  last14.forEach((item) => {
    const intensity = String(item.intensity || "").toLowerCase();
    if (intensity === "low") totalsByIntensity.low += Number(item.steps || 0);
    else if (intensity === "moderate") totalsByIntensity.moderate += Number(item.steps || 0);
    else if (intensity === "high") totalsByIntensity.high += Number(item.steps || 0);
  });

  createBarChart(intensityBarSvg, [
    { label: "Low", value: totalsByIntensity.low },
    { label: "Moderate", value: totalsByIntensity.moderate },
    { label: "High", value: totalsByIntensity.high }
  ]);
});
/* ---------------------------
   ABOUT PAGE
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const aboutUserName = document.getElementById("aboutUserName");
  if (!aboutUserName) return;

  const profile = JSON.parse(localStorage.getItem("healthtrackProfile")) || {};
  const userName = profile.fullName || "Guest";
  const avatar = userName.trim() ? userName.trim().charAt(0).toUpperCase() : "G";

  document.getElementById("aboutUserName").textContent = userName;
  document.getElementById("aboutUserAvatar").textContent = avatar;
});