from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    response = {
        "status": "ok",
        "data": {
            "games_listed": 1942,
            "tvl": 5925393.66,
            "volume_24h": 12955666.2
        }
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
