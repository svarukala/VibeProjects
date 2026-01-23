using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

public class Script : ScriptBase
{
    public override async Task<HttpResponseMessage> ExecuteAsync()
    {
        // Forward the request to get the response from the backend API
        HttpResponseMessage backendResponse = await this.Context.SendAsync(this.Context.Request, this.CancellationToken).ConfigureAwait(false);
        
        // Only transform if the response was successful
        if (!backendResponse.IsSuccessStatusCode)
        {
            return backendResponse;
        }
        
        // Get the response content from the backend
        var responseString = await backendResponse.Content.ReadAsStringAsync().ConfigureAwait(false);
        
        // Parse the JSON response
        var eventJson = JObject.Parse(responseString);
        
        // Extract only the id property
        var result = new JObject
        {
            ["id"] = eventJson["id"]
        };
        
        // Create a new response with the filtered data
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = CreateJsonContent(result.ToString())
        };
        
        return response;
    }
}
