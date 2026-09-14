self.addEventListener("push", (event) => {

    let data = {};

    try {
        data = event.data.json();
    } catch (e) {
        data = { title: "AttendEase", body: event.data ? event.data.text() : "New notification" };
    }

    const title = data.title || "AttendEase";

    const options = {
        body: data.body || "",
        icon: "/images/logo.png",
        badge: "/images/logo.png",
        data: { url: data.url || "/" }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );

});

self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    const targetUrl = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {

            for (const client of clientList) {
                if (client.url.includes(targetUrl) && "focus" in client) {
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }

        })
    );

});