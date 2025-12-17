// JavaScript to handle dynamic secondary_type choices based on primary_type selection

// Define the question hierarchy mapping directly in JavaScript
const QUESTION_HIERARCHY = {
  open_text: [
    ["text", "Short Text"],
    ["paragraph", "Paragraph / Long Text"],
    ["number", "Number (All Numbers)"],
    ["positive_number", "Positive Number (including 0)"],
    ["negative_number", "Negative Number (including 0)"],
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
  scale: [
    ["slider", "Slider / Rating Scale (0-10 default, fully customizable)"],
  ],
  grid: [
    ["grid_radio", "Grid (Single Select per row)"],
    ["grid_multi", "Grid (Multi Select per row)"],
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

function updateExclusiveColumnChoices() {
  console.log("updateExclusiveColumnChoices called");

  const optionsTextarea = document.getElementById("id_options");
  const exclusiveSelect = document.getElementById("id_exclusive_column");

  if (!optionsTextarea || !exclusiveSelect) {
    console.log("Options textarea or exclusive select not found!");
    return;
  }

  // Get current exclusive column value to preserve it if possible
  const currentValue = exclusiveSelect.value;
  console.log("Current exclusive column value:", currentValue);

  // Clear existing options
  exclusiveSelect.innerHTML = "";

  // Add default empty option
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "---------";
  exclusiveSelect.appendChild(emptyOption);

  // Parse options from textarea
  try {
    const optionsText = optionsTextarea.value.trim();
    if (optionsText) {
      const options = JSON.parse(optionsText);
      if (Array.isArray(options)) {
        console.log("Found options:", options);

        // Add each option as a choice for exclusive column
        options.forEach(function (option) {
          const optionElement = document.createElement("option");
          optionElement.value = option;
          optionElement.textContent = option;
          exclusiveSelect.appendChild(optionElement);
        });

        // Add NOTA option if it exists
        const noneOptionText = document.getElementById("id_none_option_text");
        if (noneOptionText && noneOptionText.value.trim()) {
          const notaOption = document.createElement("option");
          notaOption.value = noneOptionText.value.trim();
          notaOption.textContent = noneOptionText.value.trim();
          exclusiveSelect.appendChild(notaOption);
          console.log("Added NOTA option:", noneOptionText.value.trim());
        }

        // Try to preserve the current selection if it's still valid
        const allOptions = [...options];
        if (noneOptionText && noneOptionText.value.trim()) {
          allOptions.push(noneOptionText.value.trim());
        }

        if (currentValue && allOptions.includes(currentValue)) {
          exclusiveSelect.value = currentValue;
          console.log(
            "Preserved current exclusive column value:",
            currentValue
          );
        }
      } else {
        console.log("Options is not an array:", options);
      }
    } else {
      console.log("No options text found");
    }
  } catch (e) {
    console.log("Error parsing options:", e);
  }
}

// Initialize when the page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("Question admin JS loaded");

  const primarySelect = document.getElementById("id_primary_type");
  const secondarySelect = document.getElementById("id_secondary_type");
  const optionsTextarea = document.getElementById("id_options");
  const exclusiveSelect = document.getElementById("id_exclusive_column");
  const noneOptionText = document.getElementById("id_none_option_text");

  console.log("Primary select found:", !!primarySelect);
  console.log("Secondary select found:", !!secondarySelect);
  console.log("Options textarea found:", !!optionsTextarea);
  console.log("Exclusive select found:", !!exclusiveSelect);
  console.log("None option text found:", !!noneOptionText);

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

  // Set up exclusive column functionality
  if (optionsTextarea && exclusiveSelect) {
    console.log("Setting up exclusive column functionality");

    // Set up initial exclusive column choices
    updateExclusiveColumnChoices();

    // Add event listener for options changes
    optionsTextarea.addEventListener("input", function () {
      console.log("Options field changed");
      updateExclusiveColumnChoices();
    });

    // Also listen for blur event in case user pastes content
    optionsTextarea.addEventListener("blur", function () {
      console.log("Options field lost focus");
      updateExclusiveColumnChoices();
    });
  }

  // Set up NOTA text field listener for exclusive column updates
  if (noneOptionText && exclusiveSelect) {
    console.log("Setting up NOTA text field listener");

    // Add event listener for NOTA text changes
    noneOptionText.addEventListener("input", function () {
      console.log("NOTA text field changed");
      updateExclusiveColumnChoices();
    });

    // Also listen for blur event
    noneOptionText.addEventListener("blur", function () {
      console.log("NOTA text field lost focus");
      updateExclusiveColumnChoices();
    });
  }
});
