const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

if (password && togglePassword) {

    togglePassword.addEventListener("click", () => {

        if (password.type === "password") {

            password.type = "text";
            togglePassword.innerHTML = "🙈";

        } else {

            password.type = "password";
            togglePassword.innerHTML = "👁️";

        }

    });

}
document.querySelectorAll(".progress-fill").forEach(bar => {
    bar.style.width = bar.dataset.width + "%";
});
