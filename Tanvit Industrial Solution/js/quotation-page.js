(function () {
  "use strict";

  var form = document.getElementById("quotationForm");
  var errEl = document.getElementById("quotationFormError");
  var okEl = document.getElementById("quotationFormSuccess");
  if (!form || !errEl || !okEl) return;

  function showError(msg) {
    okEl.hidden = true;
    okEl.textContent = "";
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function clearError() {
    errEl.textContent = "";
    errEl.hidden = true;
  }

  function showSuccess(msg) {
    clearError();
    okEl.textContent = msg;
    okEl.hidden = false;
  }

  function clearSuccess() {
    okEl.textContent = "";
    okEl.hidden = true;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearSuccess();
    clearError();

    var name = String(form.q_name.value || "").trim();
    var company = String(form.q_company.value || "").trim();
    var userEmail = String(form.q_email.value || "").trim();
    var phone = String(form.q_phone.value || "").trim();
    var gst = String(form.q_gst.value || "").trim();
    var location = String(form.q_location.value || "").trim();
    var message = String(form.q_message.value || "").trim();

    if (!name) {
      showError("Please enter your name.");
      form.q_name.focus();
      return;
    }
    if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      showError("Please enter a valid email address.");
      form.q_email.focus();
      return;
    }
    if (!phone) {
      showError("Please enter your phone number.");
      form.q_phone.focus();
      return;
    }
    if (!message) {
      showError("Please describe what you need (specifications, timeline, etc.).");
      form.q_message.focus();
      return;
    }

    if (typeof TanvitEnquirySubmit === "undefined" || typeof TanvitEnquirySubmit.submit !== "function") {
      showError("Form script did not load. Refresh the page or call +91-9414110440.");
      return;
    }

    var subjectParts = ["Quotation request"];
    if (company) subjectParts.push(company);
    else subjectParts.push(name);
    var subject = subjectParts.join(" — ");

    var fullMessage = [
      "Name: " + name,
      "Company: " + (company || "—"),
      "Email: " + userEmail,
      "Phone: " + phone,
      "GST (GSTIN): " + (gst || "—"),
      "Delivery location: " + (location || "—"),
      "",
      "Requirements:",
      message
    ].join("\r\n");

    var btn = form.querySelector('button[type="submit"]');
    var prevLabel = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending…";
    }

    TanvitEnquirySubmit.submit({
      subject: subject,
      name: name,
      email: userEmail,
      phone: phone,
      message: fullMessage
    }).then(function (result) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel || "Send request";
      }
      if (result.ok) {
        form.reset();
        showSuccess("Thank you. Your request was sent successfully. We will get back to you as soon as we can.");
      } else {
        showError(result.error || "Something went wrong. Please try again.");
      }
    });
  });
})();
