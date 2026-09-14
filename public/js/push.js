async function initPush() {

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.log("Push not supported in this browser.");
        return;
    }

    try {

        const registration = await navigator.serviceWorker.register("/sw.js");

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.log("Notification permission not granted.");
            return;
        }

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY)
            });

        }

        await fetch("/save-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription)
        });

        console.log("Push subscription saved.");

    } catch (error) {
        console.error("Push setup error:", error);
    }

}

function urlBase64ToUint8Array(base64String) {

    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;

}

initPush();