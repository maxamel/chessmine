local luaunit = require('luaunit')

require 'src.backend.game_server.src.lua.redis_script_wrapper'

TestRedis = {}
function TestRedis:setUp()
    redis.call('FLUSHDB')
end

function TestRedis:testEmpty()
    value = call_redis_script('src/backend/game_server/src/lua/match.lua', {"search_pool_5", 1450, 1550, "me"}, {})
    luaunit.assertEquals(value, 0)
end

function TestRedis:testSinglePlayer()
    redis.call('ZADD', "search_pool_5", 1550, "me")
    value = call_redis_script('src/backend/game_server/src/lua/match.lua', {"search_pool_5", 1450, 1550, "me"}, {})
    luaunit.assertEquals(value, 1)
end

function TestRedis:testSingleOpponent()
    redis.call('ZADD', "search_pool_5", 1550, "me")
    redis.call('ZADD', "search_pool_5", 1500, "opponent")
    value = call_redis_script('src/backend/game_server/src/lua/match.lua', {"search_pool_5", 1450, 1580, "me"}, {})
    luaunit.assertEquals(value, "opponent")
end

function TestRedis:testSearchPlayerNotExists()
    redis.call('ZADD', "search_pool_5", 1500, "opponent")
    value = call_redis_script('src/backend/game_server/src/lua/match.lua', {"search_pool_5", 1450, 1580, "me"}, {})
    luaunit.assertEquals(value, 0)
end

function TestRedis:tearDown()
    redis.call('FLUSHDB')
end

os.exit( luaunit.LuaUnit.run() )