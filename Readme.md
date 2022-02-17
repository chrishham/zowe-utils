

# Zowe Utils

A convenience wrapper for [Zowe Cli](https://www.npmjs.com/package/@zowe/cli). 

![npm](https://img.shields.io/npm/v/zowe-utils)
![NPM](https://img.shields.io/npm/l/zowe-utils)
![npm](https://img.shields.io/npm/dw/zowe-utils)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

-----
This module exports two Objects:

__1. [ZosJob](#zosjob) :__ Submit a Job and get a promise , that resolves to execution's outlist.

1. Create a job from a jcl (string/ local file/ pds member) : ```let job = new ZosJob(jcl)``` .
2. Submit the Job with ```job.sub()``` and get back a Promise.
3. Watch job's running status by subscribing to ```'status-change'``` event : ```job.on('status-change', newStatus => console.log(newStatus))``` .
4. Cancel job's execution at any time , with ```job.cancel()```.


__2. [ZosFtp](#zosftp) :__ Ftp common operations.

1. Get/Put/Del a dataset or PDS member from/to mainframe, e.g. : ```ZosFtp.del('U001.ZOWEUTIL.FILE')```
2. List Directories , e.g. : ```ZosFtp.list('U001.ZOWEUTIL.PDS')```

----
## Prerequisites

* Node.js: Any supported Node.js LTS version. For an up-to-date list of supported LTS versions, see [Nodejs.org](https://nodejs.org/en/about/releases/).

* [Zowe](https://docs.zowe.org/stable/user-guide/systemrequirements-cli/#host-side) installed at Z/OS.

* [Zowe Cli](https://www.npmjs.com/package/@zowe/cli) installed globally at local machine. [Zowe Cli @next](https://docs.zowe.org/stable/user-guide/cli-install-cli-next/#install-zowe-cli-from-npm) is strongly recommended for better performance.

* Your z/OS UserId should be a member of group IZUUSER.

-----

## Getting Started
Install the package to your project:

```
npm i zowe-utils --save 

or

yarn add zowe-utils
```

In your code :
```js
const zoweUtils = require('zowe-utils')
const config = {
  user: 'ZOS_USERNAME',      // String: REQUIRED
  password: 'ZOS_PASSWD',    // String: REQUIRED
  host: 'ZOSMF_HOST',          // String: REQUIRED, host's IP address 
  port: ZOSMF_PORT           // Number: OPTIONAL, defaults to 30443.
}
const { ZosJob, ZosFtp } = zoweUtils(config)
```
Now you have available both ```ZosJob & ZosFtp ``` Objects.

For a full list of config properties check the [API](#api) section.

Try to submit a jcl that resides at mainframe , e.g. : ```'U001.ZOWEUTIL.PDS(TESTJCL)'```

```js
let jcl = {
  name: 'TESTJCL',                      // String: REQUIRED, Assign a name to your job, used for logging and outlist save name
  description: 'Basic Jcl with RC=0',   // String: Optional
  source: 'U001.ZOWEUTIL.PDS(TESTJCL)', // String: REQUIRED
  sourceType: 'hostFile',               // String: REQUIRED
  RC: '0000'                            // String: REQUIRED, Maximum expected return code
}

let job = new ZosJob(jcl)
try {
  let outlist = await job.sub()
  console.log('job.RC :',job.RC)
} catch(error) {
  console.log(error)
}
```
----
## API
```js 
const zoweUtils = require('zowe-utils')
const { ZosJob, ZosFtp } = zoweUtils(config)
```
Initialise ZosJob and ZosFtp by providing the config object:
* ```config```<_object_>:
  * **user** <_string_>: **Required.** 
  * **password** <_string_>: **Required.**
  * **host** <_string_>: **Required.** IP address of ZOSMF. 
  * **port** <_number_>: _Optional_. **Default:** 30443
  * **encoding** <_string_>: _Optional_. The encoding of the host. Local JCL's and datasets **should always be in 'UTF8'** before submitting/uploading to host . **Default:** ```'UTF8'```
  * **watchJobInterval** <_number_>: _Optional_. Time interval (**ms**) used internally by ZosJob to watch Job's status during execution. If the host is not powerful enough , increase this number. **Default:** ```1000```
  * **deleteMainframeOutlist** <_boolean_>: _Optional_. Set this to ```false``` if you want  ZosJob to keep outlist at host, after job completion. **Default:** ```true``` *Not Yet Implemented*
  * **loggingFunction**<_function_>: _Optional_. Handle / store logs the way you want, instead of logging them at the terminal. For example you can use ```test/debug.js``` module , to write to a file of your choice. **Default:** ```console.log```

### ZosJob
```js 
const zoweUtils = require('zowe-utils')
const { ZosJob } = zoweUtils(config)
```
* Constructor : 
```js 
let job = new ZosJob(jcl)
```

* ```jcl```<_object_>:
  * **name** <_string_>: **Required.** Provide a name for your job. Used by ZosJob for logging and naming outlists. e.g. ```'TESTJCL'```
  * **description** <_string_>: _Optional_.A description of what the job is doing so that you can have all the information attached to the ```job``` object. e.g. ```'Testing ZosJob basic functionality.'```
  * **source** <_string_>: **Required.** This can be a path of a local file , a Javascript String or a host PDS member containing valid JCL code. Examples:
    * Local File:

      ``` 'C:\\local.jcl'``` 
    * Host PDS member:

      ``` 'U001.ZOWEUTIL.PDS(TESTJCL)'``` 
    * Javascript String ( **has at least one newline ('\n') character** ):
      ```
      '//U001T JOB (BATI,U001,U001)\n' +
      '// EXEC PGM=IEFBR14'
      ```
  * **sourceType** <_string_>: **Required.** Defines the source type and can be one of these values: 'localFile', 'hostFile', 'string'.
  * **RC** <_string_>: **Required.** The maximum RC expected by the execution of the jcl. If the returned RC is greater than the string declared here, the ```job.sub()``` promise will be rejected. e.g. ```'0004'```
  * **outlistLocalPath**<_string_>: _Optional_. The local path where to store the outlist execution results. **Default:** ```null``` 

* ```ZosJob``` Methods
  * **sub**(): Submits the job to JES. Returned promise resolves to _outlist_ of the execution.
    ```js
    try {
      let outlist = await job.sub()
      console.log(outlist)
      console.log('job.RC :',job.RC)
    } catch(error) {
      console.log(error)
    }  
    ```
  * **cancel**() : Cancel job submission. Returned promise resolves to _undefined_.
    ```js
    try {
      await job.cancel()
    } catch(error) {
      console.log(error)
    }  
    ```
* ```ZosJob``` Events
  * **'status-change'**: Emitted whenever job's running status changes e.g. from ```INPUT``` to ```ACTIVE```. 
   ```js
     job.on('status-change', newStatus => console.log(newStatus)) // 'ACTIVE'
   ```
  * **'job-id'**: Emitted when JES assigns ID to job e.g. 'JOB19788'
   ```js
     job.on('job-id', jobId => console.log(jobId)) // 'JOB19788'
   ```
### ZosFtp
* ```ZosFtp``` Methods
  * **put** ( source <_string_>:**Required**, hostFile <_string_>:**Required**, options <_object_>:**Required**): Put the local file or the Javascript String defined by ```source``` , to ```hostFile``` (it will be deleted and recreated if it exists). Returned promise resolves to _undefined_.
    * **options**
      * **sourceType**<_string_>: **Required**. Can be either ```'localFile'``` or ```'string'```. 
      * **allocationsOptions**<_pairs_of_key_values>: **Optional**. You can specify the allocation attributes listed under [options](https://docs.zowe.org/stable/web_help/docs/zowe_zos-files_create_data-set-sequential.html) of ``` zowe zos-files create data-set-sequential``` command. e.g.  

        ```js 
        recfm: 'FB',
        lrecl: 300
        ```

    ```js
    try {
      // source can be a path to local file 
      await ZosFtp.put('C:\\local.txt','U001.ZOWEUTIL.FILE',{
        sourceType: 'localFile'
      })
      // or a Javascript String.
      await ZosFtp.put('I am going to host!','U001.ZOWEUTIL.STRING', {
        sourceType: 'string'
      })
      // supply allocation parameters
      await ZosFtp.put('C:\\local.txt','U001.ZOWEUTIL.FILE2',{
        sourceType: 'localFile',
        recfm : 'FB', 
        lrecl:50, 
        size: '125CYL'
      })
    } catch(error) {
      console.log(error)
    }  
    ```
  * **get** ( hostFile <_string_>:**Required**, localFile <_string_>:_Optional_): Download the ```hostFile``` z/OS dataset or PDS member to a ```localFile``` path. If ```localFile``` is omitted,  then the Promise will resolve with the contents of the host file as a Javascript String.

    ```js
    try {
      // download hostFile to localFile
      await ZosFtp.get('U001.ZOWEUTIL.FILE','C:\\local3.txt')
      // get contents of hostFile as a Javascript String.
      const result = await ZosFtp.get('U001.ZOWEUTIL.STRING')
      console.log(result) // 'I am going to host!'
    } catch(error) {
      console.log(error)
    }  
    ```
  * **del** ( hostFile <_string_>:**Required**): Delete the ```hostFile``` Dataset, PDS or PDS member.
    ```js
    try {
      await ZosFtp.del('U001.ZOWEUTIL.FILE')
    } catch(error) {
      console.log(error)
    }  
    ```
  * **list** ( hostPath <_string_>:**Required**): List dataset or PDS members defined by the ```hostpath``` variable.
    ```js
      try {
        const result = await ZosFtp.list('U001.ZOWEUTIL.PDS')
        console.log(result) 
      } catch(error) {
        console.log(error)
      }  
      ```
-----

## Running the tests
Create a ```.env``` file at the root of the project and assign the following global variables:

```env
ZOS_FTP_USERNAME='my_user_id'
ZOS_FTP_PASSWD='my_password'
ZOS_FTP_HOST='host_ip_address'
ZOS_FTP_PORT='host_port'
ZOS_ENCODING='host_encoding'
ZOS_JOB_STATEMENT='//jobName JOB (SYSS,userId,userId)' # Minimal JOB statement needed by your z/OS installation for JCL to run 
```
Then issue the test command:

```
npm run test

or 

yarn test
```

------

## Authors

* **Christopher Chamaletsos** 

See also the list of [contributors](https://github.com/chrishham/zowe-utils/graphs/contributors) who participated in this project.

------
## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
