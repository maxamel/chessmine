package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
)

func main() {
	u, _ := url.Parse("http://host.docker.internal:5000")

	rp := httputil.NewSingleHostReverseProxy(u)

	panic(http.ListenAndServe(":80", rp))
}