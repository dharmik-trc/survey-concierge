// JavaScript to handle dynamic secondary_type choices based on primary_type selection

// Define the question hierarchy mapping directly in JavaScript
const QUESTION_HIERARCHY = {
  open_text: [
    ["text", "Short Text"],
    ["paragraph", "Paragraph / Long Text"],
    ["number", "Number"],
    ["email", "Email"],
    ["date", "Date"],
    ["time", "Time"],
  ],
  form: [
    ["multiple_choices", "Multiple Choices (Multi Select)"],
    ["radio", "Radio (Single Select)"],
    ["dropdown", "Dropdown"],
    ["form_fields", "Form Fields (Multiple Inputs with Validation)"],
    ["fields", "Custom Fields (Name, Address, etc.)"],
    ["yes_no", "Yes / No"],
  ],
  grid: [
    ["grid_radio", "Grid (Single Select per row)"],
    ["grid_multi", "Grid (Multi Select per row)"],
    ["ranking", "Ranking"],
  ],
};

function updateSecondaryChoices(primaryType) {
  console.log("updateSecondaryChoices called with:", primaryType);

  const secondarySelect = document.getElementById("id_secondary_type");
  if (!secondarySelect) {
    console.log("Secondary select not found!");
    return;
  }

  console.log(
    "Secondary select found, current options:",
    secondarySelect.options ? secondarySelect.options.length : 0
  );

  // Get the current selected value to preserve it if possible
  const currentValue = secondarySelect.value;
  console.log("Current secondary value:", currentValue);

  // Only proceed if this is actually a select element
  if (secondarySelect.tagName.toLowerCase() !== "select") {
    console.log(
      "Secondary element is not a select, it's a:",
      secondarySelect.tagName
    );
    return;
  }

  // Clear existing options
  secondarySelect.innerHTML = "";

  // Add default empty option
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "---------";
  secondarySelect.appendChild(emptyOption);

  // Get choices for the selected primary type
  const choices = QUESTION_HIERARCHY[primaryType] || [];
  console.log("Available choices for", primaryType, ":", choices);

  // Add new options
  choices.forEach(function (choice) {
    const option = document.createElement("option");
    option.value = choice[0];
    option.textContent = choice[1];
    secondarySelect.appendChild(option);
  });

  console.log("Added", choices.length, "options to secondary select");

  // Try to preserve the current selection if it's still valid
  const validChoices = choices.map((choice) => choice[0]);
  if (currentValue && validChoices.includes(currentValue)) {
    secondarySelect.value = currentValue;
    console.log("Preserved current value:", currentValue);
  } else if (choices.length > 0) {
    // If current value is not valid, select the first option
    secondarySelect.value = choices[0][0];
    console.log("Selected first option:", choices[0][0]);
  }
}

// Initialize when the page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("Question admin JS loaded");

  const primarySelect = document.getElementById("id_primary_type");
  const secondarySelect = document.getElementById("id_secondary_type");

  console.log("Primary select found:", !!primarySelect);
  console.log("Secondary select found:", !!secondarySelect);

  if (primarySelect) {
    console.log(
      "Setting up initial secondary choices for:",
      primarySelect.value
    );
    // Set up the initial secondary choices
    updateSecondaryChoices(primarySelect.value);

    // Add event listener for changes
    primarySelect.addEventListener("change", function () {
      console.log("Primary type changed to:", this.value);
      updateSecondaryChoices(this.value);
    });
  } else {
    console.log(
      "Primary select not found - this might not be the question admin page"
    );
  }
});
