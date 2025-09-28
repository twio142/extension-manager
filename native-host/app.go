package main

import (
	"encoding/binary"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// Message is the message received from the extension
type Message struct {
	URL string `json:"url"`
}

func main() {
	for {
		var length uint32
		err := binary.Read(os.Stdin, binary.LittleEndian, &length)
		if err != nil {
			if err == io.EOF {
				return
			}
			panic(err)
		}

		if length == 0 {
			return
		}

		msgBytes := make([]byte, length)
		_, err = io.ReadFull(os.Stdin, msgBytes)
		if err != nil {
			panic(err)
		}

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		if err != nil {
			panic(err)
		}

		open(msg.URL)
	}
}

func open(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", strings.ReplaceAll(url, "&", "^&"))
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
